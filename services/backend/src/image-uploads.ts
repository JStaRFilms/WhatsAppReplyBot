import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { z } from 'zod';
import { DomainError, type Workflow, type ImageUpload } from '@replybot/core';

export const MAX_IMAGE_BYTES = 10*1024*1024;
export async function normalizeOwnerImage(bytes: Buffer): Promise<Omit<ImageUpload, 'id'> & {bytes: Buffer}> {
  if (!bytes.length) throw new DomainError('invalid_image',422);
  if (bytes.length > MAX_IMAGE_BYTES) throw new DomainError('image_too_large',413);
  try {
    const metadata = await sharp(bytes,{limitInputPixels:32*1024*1024}).metadata();
    if (!['jpeg','png','webp','gif','heif'].includes(metadata.format ?? '')) throw new DomainError('unsupported_image',422);
    const normalized = await sharp(bytes,{limitInputPixels:32*1024*1024,pages:1})
      .rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true})
      .flatten({background:'#ffffff'}).jpeg({quality:85}).timeout({seconds:5}).toBuffer({resolveWithObject:true});
    if (normalized.data.length > MAX_IMAGE_BYTES) throw new DomainError('image_too_large',413);
    return {bytes:normalized.data,mime:'image/jpeg',width:normalized.info.width,height:normalized.info.height};
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('invalid_image',422);
  }
}

// The parent's onRequest owner-auth hook applies to this route too.
export function registerImageUploads(app: FastifyInstance, flow: Workflow): void {
  app.addContentTypeParser('application/octet-stream',{parseAs:'buffer',bodyLimit:MAX_IMAGE_BYTES},(_request,body,done) => done(null,body));
  let active = 0;
  app.post('/v1/conversations/:id/uploads',{
    bodyLimit:MAX_IMAGE_BYTES,
    errorHandler(error,_request,reply) {
      if (error instanceof DomainError) return reply.code(error.status).send({error:error.code});
      if (error instanceof z.ZodError) return reply.code(422).send({error:'invalid_request'});
      if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send({error:'image_too_large'});
      return reply.code(500).send({error:'service_error'});
    },
  },async (request,reply) => {
    const {id} = z.object({id:z.string().min(1).max(128)}).parse(request.params);
    const requestId = z.string().min(1).max(128).parse(request.headers['x-request-id']);
    flow.conversation(id);
    if (!Buffer.isBuffer(request.body)) throw new DomainError('binary_image_required',415);
    if (active >= 2) throw new DomainError('image_upload_busy',503);
    active++;
    try {
      const image = await normalizeOwnerImage(request.body);
      const upload = flow.stageImage(id,image,requestId);
      return reply.header('Cache-Control','no-store').send(upload);
    } finally { active--; }
  });
}
