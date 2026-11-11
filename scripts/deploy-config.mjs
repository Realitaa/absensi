import { readFile, writeFile } from 'node:fs/promises'
import { parse } from 'jsonc-parser'

const sourcePath = new URL('../wrangler.jsonc', import.meta.url)
const outputPath = new URL('../wrangler.deploy.jsonc', import.meta.url)

const DEPLOY_D1_DATABASE_ID = process.env.DEPLOY_D1_DATABASE_ID
const DEPLOY_D1_DATABASE_NAME = process.env.DEPLOY_D1_DATABASE_NAME || 'absensi'
const DEPLOY_R2_BUCKET = process.env.DEPLOY_R2_BUCKET

if (!DEPLOY_D1_DATABASE_ID) {
  throw new Error('Missing DEPLOY_D1_DATABASE_ID environment variable!')
}

const source = await readFile(sourcePath, 'utf8')
const config = parse(source)

// Override D1 database config with production settings
if (config.d1_databases && config.d1_databases[0]) {
  config.d1_databases[0].database_id = DEPLOY_D1_DATABASE_ID
  config.d1_databases[0].database_name = DEPLOY_D1_DATABASE_NAME
}

if (DEPLOY_R2_BUCKET) {
  config.r2_buckets = config.r2_buckets || []
  const photosBinding = config.r2_buckets.find(
    bucket => bucket.binding === 'PHOTOS'
  )
  if (photosBinding) {
    photosBinding.bucket_name = DEPLOY_R2_BUCKET
  } else {
    config.r2_buckets.push({
      binding: 'PHOTOS',
      bucket_name: DEPLOY_R2_BUCKET
    })
  }
}

await writeFile(outputPath, JSON.stringify(config, null, 2), 'utf8')
console.log('wrangler.deploy.jsonc successfully generated!')
