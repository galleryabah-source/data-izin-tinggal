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