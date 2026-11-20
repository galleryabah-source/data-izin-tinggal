/**
 * Server-side CSV source verifier foundation.
 *
 * This is a private helper, not an RPC and not a Drive uploader. It accepts a
 * Blob that has already been obtained by a trusted server-side upload/archive
 * workflow. The current browser intake does not call it and does not upload the
 * original file, so existing CLIENT_ATTESTED records remain client-attested.
 *
 * XLSX and image/OCR sources are deliberately unsupported here.
 */
function kanwilVerifyCsvBlobV1_(sourceBlob,browserEvidence,browserSha256){
  if(!sourceBlob||typeof sourceBlob.getBytes!=='function'||typeof sourceBlob.getDataAsString!=='function')
    throw new Error('KANWIL_SERVER_SOURCE_BLOB_REQUIRED');
  const bytes=sourceBlob.getBytes();
  if(!Array.isArray(bytes)||!bytes.length)throw new Error('KANWIL_SERVER_SOURCE_BYTES_EMPTY');
  const text=sourceBlob.getDataAsString('UTF-8');
  if(typeof text!=='string'||!text.length)throw new Error('KANWIL_SERVER_SOURCE_TEXT_EMPTY');
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes);
  const serverSha256=digest.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');
  if(browserSha256&&String(browserSha256).toLowerCase()!==serverSha256)
    throw new Error('KANWIL_SOURCE_SHA256_MISMATCH');
  const parsed=parseKanwilPermitCsvV1(text,{delimiter:','});
  if(!parsed||!parsed.ok)throw new Error('KANWIL_SERVER_CSV_PARSE_FAILED: '+String(parsed&&parsed.reason||'UNKNOWN'));
  const evidence=parsed.sourceEvidence||{};
  if(evidence.version!=='KANWIL_SOURCE_ROW_EVIDENCE_V1'||
     !Number.isSafeInteger(evidence.sourceDataRowCount)||
     evidence.parsedRecordCount!==parsed.records.length||
     !Array.isArray(evidence.sourceRowNumbers))
    throw new Error('KANWIL_SERVER_CSV_EVIDENCE_INVALID');
  const client=browserEvidence&&typeof browserEvidence==='object'?browserEvidence:{};
  if(client.version!==evidence.version||
     Number(client.sourceDataRowCount)!==evidence.sourceDataRowCount||
     Number(client.parsedRecordCount)!==evidence.parsedRecordCount||
     JSON.stringify(client.sourceRowNumbers)!==JSON.stringify(evidence.sourceRowNumbers))
    throw new Error('KANWIL_BROWSER_SERVER_PARSER_MISMATCH');
  return {
    ok:true,
    verificationStatus:'SERVER_VERIFIED_CSV',
    sourceFileSha256:serverSha256,
    sourceByteSize:bytes.length,
    parserVersion:'KANWIL_PERMIT_CSV_V1',
    sourceEvidence:{
      version:evidence.version,
      sourceDataRowCount:evidence.sourceDataRowCount,
      parsedRecordCount:evidence.parsedRecordCount,
      sourceRowNumbers:evidence.sourceRowNumbers.slice(),
      measurement:evidence.measurement
    },
    records:parsed.records
  };
}
