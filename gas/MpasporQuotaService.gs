/**
 * M-Paspor quota snapshot — source-derived from:
 * "Rekapitulasi Kuota Paspor Oktober 2026.pdf"
 * Effective period: 2026-10
 *
 * This is a read-only presentation/service layer. It is intentionally kept
 * separate from PASSPORT_SERVICE_MONTHLY so the canonical transaction dataset
 * and historical baseline are not changed.
 */
const MPASPOR_QUOTA_SNAPSHOT = Object.freeze({
  datasetKey: 'PASSPORT_MPASPOR_QUOTA',
  period: '2026-10',
  periodLabel: 'Oktober 2026',
  sourceDocument: 'Rekapitulasi Kuota Paspor Oktober 2026.pdf',
  totals: Object.freeze({ mpaspor: 3205, overall: 3760 }),
  offices: Object.freeze([
    { office: 'KANIM KELAS I TPI BANDUNG', mpaspor: 320, overall: 440, locations: [
      { name: 'Kanim (Kantor Utama)', booths: 3, daily: 210, note: 'Termasuk 150 reguler, 40 percepatan, 20 polikarbonat; total booth 6 termasuk prioritas, Ramah HAM, dan percepatan.' },
      { name: 'Unit Layanan Paspor Miko Mall', booths: 2, daily: 110, note: 'Termasuk 90 reguler dan 20 percepatan.' },
      { name: 'MPP Kota Bandung', booths: 1, daily: 30, note: 'Khusus walk-in paspor elektronik laminasi.' },
      { name: 'MPP Kabupaten Bandung', booths: 1, daily: 30, note: 'Khusus walk-in paspor elektronik laminasi.' },
      { name: 'MPP Kabupaten Bandung Barat', booths: 1, daily: 30, note: 'Khusus walk-in paspor elektronik laminasi.' },
      { name: 'MPP Kota Cimahi', booths: 1, daily: 30, note: 'Khusus walk-in paspor elektronik laminasi.' }
    ]},
    { office: 'KANIM KELAS I TPI CIREBON', mpaspor: 250, overall: 350, locations: [
      { name: 'Kantor Imigrasi', booths: 3, daily: 210, note: 'Total 8 booth; termasuk 3 M-Paspor, loket Ramah HAM/prioritas, percepatan, dan loket PMI.' },
      { name: 'Iron Prima GCM', booths: 2, daily: 20, note: 'Setiap hari; masih tahap uji coba.' },
      { name: 'MPP Majalengka', booths: 1, daily: 20, note: 'Pelaksanaan setiap hari Senin.' },
      { name: 'LTSA Indramayu', booths: 2, daily: 100, note: 'Walk-in untuk PMI.' }
    ]},
    { office: 'KANIM KELAS I NON TPI BOGOR', mpaspor: 560, overall: 560, locations: [
      { name: 'Kantor Imigrasi', booths: 8, daily: 480, note: 'Kuota M-Paspor termasuk percepatan M-Paspor; tidak termasuk walk-in prioritas dan walk-in percepatan.' },
      { name: 'MPP Kota Bogor', booths: 1, daily: 40, note: '1 booth layanan reguler untuk paspor baru dan penggantian.' },
      { name: 'MPP Kabupaten Bogor', booths: 1, daily: 40, note: '1 booth layanan reguler untuk paspor baru dan penggantian.' }
    ]},
    { office: 'KANIM KELAS I NON TPI BEKASI', mpaspor: 675, overall: 675, locations: [
      { name: 'Kanim', booths: 8, daily: 480, note: 'Termasuk layanan reguler dan 50 kuota percepatan paspor elektronik laminasi.' },
      { name: 'ULP Cibubur', booths: 1, daily: 50, note: 'Khusus layanan reguler paspor elektronik laminasi; 2 booth, 1 Ramah HAM.' },
      { name: 'MPP Kota Bekasi', booths: 1, daily: 25, note: 'Khusus layanan reguler paspor elektronik laminasi; 25 disediakan Pemda Bekasi.' },
      { name: 'LOUNGE', booths: 2, daily: 120, note: 'Khusus layanan percepatan paspor elektronik laminasi.' }
    ]},
    { office: 'KANIM KELAS I NON TPI KARAWANG', mpaspor: 215, overall: 300, locations: [
      { name: 'Kantor Imigrasi', booths: 3, daily: 200, note: 'Total booth 5; pembukaan kuota mengikuti skema 10% tiga bulan sebelumnya, 30% dua bulan sebelumnya, 60% bulan berjalan. Oktober: 20 kuota permohonan telah dibuka pada sumber.' },
      { name: 'MPP Bale Madukara', booths: 1, daily: 15, note: 'Senin dan Kamis; 15 kuota M-Paspor termasuk 5 kuota walk-in melalui Teras Madukara Kabupaten Purwakarta.' },
      { name: 'LTSP Karawang (Paspor PMI/CPMI)', booths: 1, daily: 50, note: 'Walk-in, bekerja sama dengan Disnaker dan BP3MI Kabupaten Karawang dan Purwakarta.' }
    ]},
    { office: 'KANIM KELAS I NON TPI DEPOK', mpaspor: 410, overall: 485, locations: [
      { name: 'Kantor Imigrasi', booths: 4, daily: 125, note: 'Total mesin cetak 3 unit: Kantor Utama, Pesona Square, dan Sawangan.' },
      { name: 'ULP Depok Town Square', booths: 2, daily: 45, note: '' },
      { name: 'Immigration Pesona Square Lounge', booths: 3, daily: 100, note: 'Pelayanan MPP dilaksanakan Selasa sampai Kamis.' },
      { name: 'MPP Depok', booths: 1, daily: 20, note: '' },
      { name: 'Immigration Sawangan Point', booths: 2, daily: 120, note: 'Tambahan walk-in layanan prioritas 75: Kantor Utama 25, Detos 15, Pesona Square 15, MPP 5, Sawangan 15.' }
    ]},
    { office: 'KANIM KELAS I NON TPI TASIKMALAYA', mpaspor: 180, overall: 230, locations: [
      { name: 'Kantor Imigrasi', booths: 3, daily: 180, note: 'Total 4 booth terdiri dari 3 booth umum dan 1 booth Ramah HAM/prioritas.' },
      { name: 'Walk-in', booths: 0, daily: 50, note: '25 percepatan + 25 prioritas.' }
    ]},
    { office: 'KANIM KELAS II NON TPI SUKABUMI', mpaspor: 340, overall: 350, locations: [
      { name: 'Kantor Imigrasi', booths: 5, daily: 300, note: '5 booth M-Paspor, 1 booth Ramah HAM, 1 booth percepatan.' },
      { name: 'MPP Pelabuhan Ratu', booths: 1, daily: 25, note: 'Setiap Rabu dan Kamis.' },
      { name: 'Percepatan Kantor', booths: 0, daily: 15, note: '' },
      { name: 'Walk-in Kantor', booths: 0, daily: 10, note: 'Ramah HAM.' }
    ]},
    { office: 'KANIM KELAS III NON TPI CIANJUR', mpaspor: 140, overall: 150, locations: [
      { name: 'Kantor Imigrasi', booths: 2, daily: 130, note: 'Reguler.' },
      { name: 'Percepatan', booths: 0, daily: 10, note: 'Percepatan.' },
      { name: 'Walk-in Ramah HAM', booths: 1, daily: 10, note: 'Walk-in Ramah HAM.' }
    ]},
    { office: 'KANIM KELAS II NON TPI GARUT', mpaspor: 115, overall: 220, locations: [
      { name: 'Kantor Imigrasi M Paspor', booths: 2, daily: 140, note: '90 M-Paspor reguler, 25 Ramah HAM/Prioritas, 25 percepatan; 1 mesin laminasi.' },
      { name: 'MPP Sumedang', booths: 0, daily: 30, note: '' },
      { name: 'UNPAD', booths: 0, daily: 50, note: '' }
    ]}
  ])
});

function getMpasporQuotaDashboard(){
  requirePermission_('dashboard.read');
  return buildMpasporQuotaDashboard_();
}

function buildMpasporQuotaDashboard_(){
  const s=MPASPOR_QUOTA_SNAPSHOT;
  const offices=s.offices.map((o,index)=>({
    rank:index+1,
    kantor_imigrasi:o.office,
    mpaspor:o.mpaspor,
    overall:o.overall,
    ratio:o.overall?o.mpaspor/o.overall:0,
    locations:o.locations.map(x=>({
      name:x.name,
      booths:Number(x.booths||0),
      daily:Number(x.daily||0),
      note:String(x.note||'')
    }))
  }));
  return {
    datasetKey:s.datasetKey,
    period:s.period,
    periodLabel:s.periodLabel,
    sourceDocument:s.sourceDocument,
    totals:{mpaspor:s.totals.mpaspor,overall:s.totals.overall,ratio:s.totals.overall?s.totals.mpaspor/s.totals.overall:0},
    officeCount:offices.length,
    offices
  };
}

function getPublicTvMpasporQuota(){
  const d=buildMpasporQuotaDashboard_();
  return {
    datasetKey:d.datasetKey,
    period:d.period,
    periodLabel:d.periodLabel,
    totals:d.totals,
    officeCount:d.officeCount,
    offices:d.offices.map(o=>({
      rank:o.rank,
      kantor_imigrasi:o.kantor_imigrasi,
      mpaspor:o.mpaspor,
      overall:o.overall,
      ratio:o.ratio
    }))
  };
}
