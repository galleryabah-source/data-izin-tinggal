import {describe,expect,it} from "vitest";
import {PassportRowSchema,ResidencePermitRowSchema,businessKey,passportDerivedTotal,residenceDerivedTotal} from "@dasmon/domain";

describe("canonical dataset contracts",()=>{
  it("validates residence and derives total",()=>{
    const row={periode:"2026-01",kantor_imigrasi:"Kantor A",bvk:100,voa:200,itk:300,itk_peralihan:4,itas:5,itap:6,itkt:7,alih_status_itk_ke_itas:8,alih_status_itas_ke_itap:9,abg:10,epo:11,imk:12,skim:13,total:685};
    expect(ResidencePermitRowSchema.parse(row)).toEqual(row);
    expect(residenceDerivedTotal(row)).toBe(685);
  });
  it("validates passport and derives total",()=>{
    const row={periode:"2026-01",kantor_imigrasi:"Kantor A",biasa_24:10,biasa_48:20,elektronik_48:30,e_polikarbonat:40,total:100};
    expect(PassportRowSchema.parse(row)).toEqual(row);
    expect(passportDerivedTotal(row)).toBe(100);
  });
  it("rejects malformed periods",()=>{
    expect(()=>PassportRowSchema.parse({periode:"2026/01",kantor_imigrasi:"A",biasa_24:1,biasa_48:1,elektronik_48:1,e_polikarbonat:1,total:4})).toThrow();
  });
  it("uses canonical business key",()=>expect(businessKey("2026-01"," Kantor A ")).toBe("2026-01::Kantor A"));
});

describe("dataset contract registry",()=>{
  it("registers exactly the two certified v1 datasets",async()=>{
    const {DATASET_CONTRACTS}=await import("@dasmon/domain");
    expect(Object.keys(DATASET_CONTRACTS).sort()).toEqual([
      "PASSPORT_SERVICE_MONTHLY","RESIDENCE_PERMIT_SERVICE_MONTHLY"
    ]);
    expect(DATASET_CONTRACTS.RESIDENCE_PERMIT_SERVICE_MONTHLY.measures).toHaveLength(13);
    expect(DATASET_CONTRACTS.PASSPORT_SERVICE_MONTHLY.measures).toHaveLength(4);
  });

  it("keeps total derived rather than treating it as a measure",async()=>{
    const {DATASET_CONTRACTS}=await import("@dasmon/domain");
    for(const contract of Object.values(DATASET_CONTRACTS)){
      expect(contract.measures).not.toContain(contract.derivedTotal);
      expect(contract.businessKey).toEqual(["periode","kantor_imigrasi"]);
    }
  });

  it("rejects unknown dataset contracts",async()=>{
    const {assertKnownDataset}=await import("@dasmon/domain");
    expect(()=>assertKnownDataset("UNKNOWN")).toThrow("UNKNOWN_DATASET_CONTRACT");
  });
});


describe("legacy contract parity",()=>{
  it("matches the certified Residence Permit v1 column contract",async()=>{
    const {DATASET_CONTRACTS}=await import("@dasmon/domain");
    const c=DATASET_CONTRACTS.RESIDENCE_PERMIT_SERVICE_MONTHLY;
    expect(c.columns).toEqual(["periode","kantor_imigrasi","bvk","voa","itk","itk_peralihan","itas","itap","itkt","alih_status_itk_ke_itas","alih_status_itas_ke_itap","abg","epo","imk","skim","total"]);
    expect(c.required).toEqual(c.columns.slice(0,-1));
    expect(c.optional).toEqual(["total"]);
  });

  it("matches the certified Passport v1 column contract",async()=>{
    const {DATASET_CONTRACTS}=await import("@dasmon/domain");
    const c=DATASET_CONTRACTS.PASSPORT_SERVICE_MONTHLY;
    expect(c.columns).toEqual(["periode","kantor_imigrasi","biasa_24","biasa_48","elektronik_48","e_polikarbonat","total"]);
    expect(c.required).toEqual(c.columns.slice(0,-1));
    expect(c.optional).toEqual(["total"]);
  });
});


describe("domain data integrity",()=>{
  it("normalizes both components of the canonical business key",()=>{
    const {businessKey}=require("@dasmon/domain");
    expect(businessKey(" 2026-01 "," Kantor A ")).toBe("2026-01::Kantor A");
  });

  it("accepts a matching derived total",async()=>{
    const {assertMatchingDerivedTotal}=await import("@dasmon/domain");
    const row={
      periode:"2026-01",kantor_imigrasi:"Kantor A",
      bvk:10,voa:20,itk:30,itk_peralihan:0,itas:0,itap:0,itkt:0,
      alih_status_itk_ke_itas:0,alih_status_itas_ke_itap:0,abg:0,epo:0,imk:0,skim:0,total:60
    };
    expect(()=>assertMatchingDerivedTotal(row)).not.toThrow();
  });

  it("rejects a mismatched derived total",async()=>{
    const {assertMatchingDerivedTotal}=await import("@dasmon/domain");
    const row={
      periode:"2026-01",kantor_imigrasi:"Kantor A",
      bvk:10,voa:20,itk:30,itk_peralihan:0,itas:0,itap:0,itkt:0,
      alih_status_itk_ke_itas:0,alih_status_itas_ke_itap:0,abg:0,epo:0,imk:0,skim:0,total:61
    };
    expect(()=>assertMatchingDerivedTotal(row)).toThrow("DERIVED_TOTAL_MISMATCH");
  });
});


describe("contract boundary strictness",()=>{
  it("rejects unknown Residence Permit fields",async()=>{
    const {ResidencePermitRowSchema}=await import("@dasmon/domain");
    const row={
      periode:"2026-01",kantor_imigrasi:"Kantor A",
      bvk:1,voa:1,itk:1,itk_peralihan:1,itas:1,itap:1,itkt:1,
      alih_status_itk_ke_itas:1,alih_status_itas_ke_itap:1,abg:1,epo:1,imk:1,skim:1,total:15,
      unexpected_field:99
    };
    expect(ResidencePermitRowSchema.safeParse(row).success).toBe(false);
  });

  it("rejects unknown Passport fields",async()=>{
    const {PassportRowSchema}=await import("@dasmon/domain");
    const row={
      periode:"2026-01",kantor_imigrasi:"Kantor A",
      biasa_24:1,biasa_48:1,elektronik_48:1,e_polikarbonat:1,total:4,
      unexpected_field:99
    };
    expect(PassportRowSchema.safeParse(row).success).toBe(false);
  });
});


describe("P1 contract certification",()=>{
  it("certifies every registered dataset has a coherent v1 contract",async()=>{
    const {DATASET_CONTRACTS}=await import("@dasmon/domain");

    for(const contract of Object.values(DATASET_CONTRACTS)){
      expect(contract.version).toBe(1);
      expect(contract.businessKey).toEqual(["periode","kantor_imigrasi"]);
      expect(contract.derivedTotal).toBe("total");
      expect(contract.columns[0]).toBe("periode");
      expect(contract.columns[1]).toBe("kantor_imigrasi");
      expect(contract.columns.at(-1)).toBe("total");
      expect(contract.required).toEqual(contract.columns.slice(0,-1));
      expect(contract.optional).toEqual(["total"]);
      expect(new Set(contract.columns).size).toBe(contract.columns.length);
      expect(new Set(contract.measures).size).toBe(contract.measures.length);
      expect(contract.measures).not.toContain("periode");
      expect(contract.measures).not.toContain("kantor_imigrasi");
      expect(contract.measures).not.toContain("total");
    }
  });

  it("certifies all registry keys are unique",async()=>{
    const {DATASET_KEYS}=await import("@dasmon/domain");
    expect(new Set(DATASET_KEYS).size).toBe(DATASET_KEYS.length);
    expect(DATASET_KEYS).toHaveLength(2);
  });
});
