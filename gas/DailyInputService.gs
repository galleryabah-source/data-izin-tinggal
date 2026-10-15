/**
 * Phase 9 — Daily input contract foundation (read-only / disabled).
 *
 * This module is deliberately isolated from DATASET_CONTRACTS and all monthly
 * import, registry, period-close, and dashboard write paths. The measures are
 * candidate contract fields copied from the current monthly service contracts;
 * their daily operational meaning must be signed off at Gate 9.1 before use.
 *
 * No sheet is created or written by this module.
 */
const DAILY_SERVICE_CONTRACTS_V1 = Object.freeze({
  RESIDENCE_PERMIT: Object.freeze({
    serviceFamily: 'RESIDENCE_PERMIT',
    datasetKey: 'RESIDENCE_PERMIT_SERVICE_DAILY',
    version: 'candidate-v1',
    sourceContractKey: 'RESIDENCE_PERMIT_SERVICE_MONTHLY',
    measures: Object.freeze([
      'bvk', 'voa', 'itk', 'itk_peralihan', 'itas', 'itap', 'itkt',
      'alih_status_itk_ke_itas', 'alih_status_itas_ke_itap',
      'abg', 'epo', 'imk', 'skim'
    ])
  }),
  PASSPORT: Object.freeze({
    serviceFamily: 'PASSPORT',
    datasetKey: 'PASSPORT_SERVICE_DAILY',
    version: 'candidate-v1',
    sourceContractKey: 'PASSPORT_SERVICE_MONTHLY',
    measures: Object.freeze([
      'biasa_24', 'biasa_48', 'elektronik_48', 'e_polikarbonat'
    ])
  })
});

const DAILY_INPUT_GUARD_V1 = Object.freeze({
  enabled: false,
  timezone: 'Asia/Jakarta',
  featureFlagKey: 'DAILY_INPUT_ENABLED'
});

function getDailyInputPolicyV1() {
  requirePermission_('dashboard.read');
  const sheet = getDb_().getSheetByName(SHEETS.CONFIG);
  const rows = sheet ? sheet.getDataRange().getValues().slice(1) : [];
  const flag = String((rows.find(row =>
    String(row[0] || '').trim() === DAILY_INPUT_GUARD_V1.featureFlagKey
  ) || [])[1] || '').trim().toLowerCase();

  return {
    contract: 'DAILY_INPUT_POLICY_V1',
    enabled: DAILY_INPUT_GUARD_V1.enabled && flag === 'true',
    timezone: DAILY_INPUT_GUARD_V1.timezone,
    serviceFamilies: Object.keys(DAILY_SERVICE_CONTRACTS_V1).map(key => {
      const contract = DAILY_SERVICE_CONTRACTS_V1[key];
      return {
        serviceFamily: contract.serviceFamily,
        datasetKey: contract.datasetKey,
        contractVersion: contract.version,
        measureCount: contract.measures.length
      };
    })
  };
}

function getDailyServiceContractV1(serviceFamily) {
  requirePermission_('dashboard.read');
  const key = String(serviceFamily || '').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(DAILY_SERVICE_CONTRACTS_V1, key)) {
    throw new Error('DAILY_SERVICE_FAMILY_INVALID');
  }
  const contract = DAILY_SERVICE_CONTRACTS_V1[key];

  return {
    contract: 'DAILY_SERVICE_CONTRACT_V1',
    serviceFamily: contract.serviceFamily,
    datasetKey: contract.datasetKey,
    version: contract.version,
    timezone: DAILY_INPUT_GUARD_V1.timezone,
    enabled: DAILY_INPUT_GUARD_V1.enabled,
    measures: contract.measures.map(measureKey => ({
      key: measureKey,
      label: dailyMeasureLabelV1_(measureKey)
    }))
  };
}

function dailyMeasureLabelV1_(key) {
  const labels = {
    bvk: 'BVK',
    voa: 'VOA',
    itk: 'ITK',
    itk_peralihan: 'ITK Peralihan',
    itas: 'ITAS',
    itap: 'ITAP',
    itkt: 'ITKT',
    alih_status_itk_ke_itas: 'Alih Status ITK ke ITAS',
    alih_status_itas_ke_itap: 'Alih Status ITAS ke ITAP',
    abg: 'ABG',
    epo: 'EPO',
    imk: 'IMK',
    skim: 'SKIM',
    biasa_24: 'Paspor Biasa 24',
    biasa_48: 'Paspor Biasa 48',
    elektronik_48: 'Paspor Elektronik 48',
    e_polikarbonat: 'Paspor Elektronik Polikarbonat'
  };
  return labels[key] || key;
}

/**
 * Pure validator: no Apps Script service calls, no reads, and no writes.
 * Blank is missing; a literal zero is a reported zero. Totals are derived.
 */
function validateDailyInputPayloadV1(payload) {
  const input = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload : {};
  const allowedTopLevelKeys = [
    'submissionId', 'serviceFamily', 'operationalDate', 'officeKey',
    'contractVersion', 'measures'
  ];
  const family = String(input.serviceFamily || '').trim().toUpperCase();
  const contract = Object.prototype.hasOwnProperty.call(DAILY_SERVICE_CONTRACTS_V1, family)
    ? DAILY_SERVICE_CONTRACTS_V1[family] : null;
  // A null-prototype map prevents inherited names such as constructor,
  // toString, and __proto__ from bypassing unknown-field validation.
  const errors = Object.create(null);
  const addError = (key, message) => {
    if (!Object.prototype.hasOwnProperty.call(errors, key)) errors[key] = message;
  };

  Object.keys(input).forEach(key => {
    if (!allowedTopLevelKeys.includes(key)) {
      addError(key, 'Field tidak diizinkan pada kontrak input harian ini.');
    }
  });
  if (!contract) addError('serviceFamily', 'Pilih keluarga layanan yang valid.');

  const operationalDate = String(input.operationalDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operationalDate)) {
    addError('operationalDate', 'Tanggal harus berformat YYYY-MM-DD.');
  } else {
    const parsedDate = new Date(operationalDate + 'T00:00:00.000Z');
    if (Number(operationalDate.slice(0, 4)) < 1 ||
        !Number.isFinite(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== operationalDate) {
      addError('operationalDate', 'Tanggal tidak valid.');
    }
  }

  const officeKey = typeof input.officeKey === 'string' ? input.officeKey.trim() : '';
  if (!officeKey) {
    addError('officeKey', 'Kantor imigrasi harus dipilih dari referensi kantor.');
  } else if (officeKey.length > 128) {
    addError('officeKey', 'Kunci kantor tidak valid.');
  }

  if (Object.prototype.hasOwnProperty.call(input, 'total')) {
    addError('total', 'Total dihitung oleh server dan tidak boleh dikirim oleh klien.');
  }

  const submissionId = String(input.submissionId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
    addError('submissionId', 'submissionId harus UUID valid untuk idempotensi.');
  }

  if (contract && String(input.contractVersion || '').trim() !== contract.version) {
    addError('contractVersion', 'Versi kontrak berubah; muat ulang kontrak.');
  }

  const measuresInput = input.measures && typeof input.measures === 'object' &&
    !Array.isArray(input.measures) ? input.measures : {};
  const normalizedMeasures = {};

  if (contract) {
    Object.keys(measuresInput).forEach(key => {
      if (!contract.measures.includes(key)) {
        addError('measures.' + key, 'Field tidak diizinkan pada kontrak layanan ini.');
      }
    });

    contract.measures.forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(measuresInput, key)) {
        addError('measures.' + key, 'Nilai wajib diisi; masukkan 0 bila memang nihil.');
        return;
      }
      const value = measuresInput[key];
      if (value === null || value === undefined || String(value).trim() === '') {
        addError('measures.' + key, 'Nilai wajib diisi; masukkan 0 bila memang nihil.');
        return;
      }
      if (!(typeof value === 'number' || typeof value === 'string') ||
          !/^\d+$/.test(String(value).trim())) {
        addError('measures.' + key, 'Nilai harus bilangan bulat non-negatif.');
        return;
      }
      const numberValue = Number(value);
      if (!Number.isSafeInteger(numberValue) || numberValue < 0) {
        addError('measures.' + key, 'Nilai harus bilangan bulat non-negatif yang aman.');
        return;
      }
      normalizedMeasures[key] = numberValue;
    });
  }

  let total = null;
  if (contract && contract.measures.every(key =>
    Object.prototype.hasOwnProperty.call(normalizedMeasures, key)
  )) {
    total = contract.measures.reduce((sum, key) => sum + normalizedMeasures[key], 0);
    if (!Number.isSafeInteger(total)) {
      addError('measures', 'Total melampaui batas integer aman.');
      total = null;
    }
  }

  const valid = Object.keys(errors).length === 0;
  return {
    ok: valid,
    code: valid ? 'DAILY_INPUT_VALIDATION_OK' : 'DAILY_INPUT_VALIDATION_FAILED',
    errors,
    normalized: valid ? {
      submissionId,
      serviceFamily: family,
      operationalDate,
      officeKey,
      contractVersion: contract.version,
      measures: normalizedMeasures,
      total
    } : null
  };
}
