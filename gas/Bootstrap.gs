function bootstrapCurrentUser(){
  const email=String(Session.getEffectiveUser().getEmail()||Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  if(!email)throw new Error('Tidak dapat membaca email akun Google yang menjalankan script.');
  return bootstrapAdmin(email,'Administrator');
}
