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
