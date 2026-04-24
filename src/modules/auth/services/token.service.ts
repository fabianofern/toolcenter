import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const privateKeyPath = path.join(process.cwd(), 'keys', 'private.pem');
const publicKeyPath = path.join(process.cwd(), 'keys', 'public.pem');

let privateKey = '';
let publicKey = '';

try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  publicKey = fs.readFileSync(publicKeyPath, 'utf8');
} catch (err) {
  console.error('Failed to load RSA keys. Did you run `npm run generate-keys`?');
}

export const signToken = (payload: any): string => {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
};

export const verifyToken = (token: string): any => {
  const payload = jwt.verify(token, publicKey, { 
    algorithms: ['RS256'],
    issuer: 'toolcenter-iam-server',
    audience: 'toolcenter-tools',
  }) as any;
  if (!payload.sub || !payload.jti) {
    throw new Error('Invalid token structure');
  }
  return payload;
};

export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};

export const getPublicKey = (): string => publicKey;
