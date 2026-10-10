import { describe, expect, it } from "vitest";
import {
  decode,
  guessMapping,
  merchantKey,
  parseAmount,
  parseDate,
  readRows,
  rowHashes,
  suggestCategory,
  toEur,
  type BankId,
} from "./bank-import";

// Shapes of real exports (names and numbers made up).
const SPARKASSE = `"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"
"DE00721500000000000000";"03.10.26";"03.10.26";"KARTENZAHLUNG";"REWE SAGT DANKE 1234";"";"";"";"";"";"";"REWE Markt GmbH";"DE11";"COBADEFF";"-48,17";"EUR";"Umsatz gebucht"
"DE00721500000000000000";"01.10.26";"01.10.26";"LASTSCHRIFT";"Miete Oktober";"";"";"";"";"";"";"Wohnbau Eichstätt";"DE22";"BYLADEM1";"-1.335,00";"EUR";"Umsatz gebucht"
"DE00721500000000000000";"30.09.26";"30.09.26";"GUTSCHRIFT";"Lohn 09/2026";"";"";"";"";"";"";"Bar Kultur GmbH";"DE33";"GENODEF1";"2.150,00";"EUR";"Umsatz gebucht"
"DE00721500000000000000";"04.10.26";"04.10.26";"LASTSCHRIFT";"Ihr Einkauf bei Zalando";"";"";"";"";"";"";"PayPal Europe S.a.r.l. et Cie S.C.A";"LU44";"PPLXLUL2";"-59,90";"EUR";"Umsatz vorgemerkt"
"DE00721500000000000000";"03.10.26";"03.10.26";"KARTENZAHLUNG";"REWE SAGT DANKE 1234";"";"";"";"";"";"";"REWE Markt GmbH";"DE11";"COBADEFF";"-48,17";"EUR";"Umsatz gebucht"
`;

const REVOLUT = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-10-02 12:01:10,2026-10-03 09:00:00,Lieferando,-23.40,0.00,EUR,COMPLETED,120.10
TOPUP,Current,2026-10-01 08:00:00,2026-10-01 08:00:01,Top-up by *1234,100.00,0.00,EUR,COMPLETED,143.50
CARD_PAYMENT,Current,2026-10-05 19:30:00,,Netflix,-13.99,0.00,EUR,PENDING,129.51
EXCHANGE,Current,2026-10-04 10:00:00,2026-10-04 10:00:00,Exchanged to USD,-50.00,0.25,EUR,COMPLETED,93.25
`;

const BCA = `Informasi Rekening - Mutasi Rekening
No. rekening : 1234567890
Nama : RIALTO EFFENDY
Periode : 01/09/2026 - 30/09/2026
Kode Mata Uang : IDR

Tanggal Transaksi,Keterangan,Cabang,Jumlah,,Saldo
'05/09,'TRSF E-BANKING DB 0509/FTSCY/WS95051 IBU SITI,'0000,"1,500,000.00",DB,"8,500,000.00"
'10/09,'SETORAN TUNAI,'0123,"2,000,000.00",CR,"10,500,000.00"
'PEND,'BIAYA ADM,'0000,"15,000.00",DB,"10,485,000.00"
Saldo Awal,:,"10,000,000.00"
`;

const PAYPAL_DE = `﻿"Datum","Uhrzeit","Zeitzone","Name","Typ","Status","Währung","Brutto","Gebühr","Netto","Absender E-Mail-Adresse","Empfänger E-Mail-Adresse","Transaktionscode"
"04.10.2026","10:12:00","Europe/Berlin","Zalando SE","Handyzahlung","Abgeschlossen","EUR","-59,90","0,00","-59,90","me@example.com","shop@zalando.de","1AB"
"04.10.2026","10:12:01","Europe/Berlin","","Bankgutschrift auf PayPal-Konto","Abgeschlossen","EUR","59,90","0,00","59,90","","me@example.com","2CD"
"06.10.2026","18:00:00","Europe/Berlin","Spotify AB","Abonnementzahlung","Abgeschlossen","EUR","-10,99","0,00","-10,99","me@example.com","pay@spotify.com","3EF"
`;

const WISE = `"TransferWise ID",Date,Amount,Currency,Description,"Payment Reference","Running Balance","Exchange From","Exchange To","Exchange Rate","Payer Name","Payee Name","Payee Account Number",Merchant,"Card Last Four Digits","Card Holder Full Name",Attachment,Note,"Total fees"
TRANSFER-1,01-10-2026,-200.00,EUR,"Sent money to Siti",Ibu,"300.00",EUR,IDR,17950.00,,"Siti Aminah",123,,,,,,"1.71"
CARD-2,03-10-2026,-8.50,EUR,"Card transaction of 8.50 EUR issued by Backhaus Eichstaett",,"291.50",,,,,,,"Backhaus Eichstaett",1111,"Rialto Effendy",,,0.00
`;

const TFBANK = `Datum;Beschreibung;Betrag
02.10.2026;AMAZON.DE*AB12CD;-34,99
05.10.2026;Zahlung erhalten - Danke;150,00
07.10.2026;ARAL STATION 4711;-62,30
`;

const rows = (text: string, bank: BankId) => readRows(text, guessMapping(text, bank));

describe("bank import: reading files", () => {
  it("Sparkasse: ; and German numbers, two-digit years, pending rows skipped", () => {
    const m = guessMapping(SPARKASSE, "sparkasse");
    expect(m.delimiter).toBe(";");
    expect(m.decimal).toBe(",");
    const { rows: r, skipped } = readRows(SPARKASSE, m);
    expect(r.map((x) => [x.date, x.amount, x.payee])).toEqual([
      ["2026-10-03", -48.17, "REWE Markt GmbH"],
      ["2026-10-01", -1335, "Wohnbau Eichstätt"],
      ["2026-09-30", 2150, "Bar Kultur GmbH"],
      ["2026-10-03", -48.17, "REWE Markt GmbH"],
    ]);
    expect(r[1].purpose).toBe("Miete Oktober");
    expect(skipped).toHaveLength(1); // "Umsatz vorgemerkt" = not booked yet
  });

  it("Sparkasse file in ISO-8859-1 is read correctly", () => {
    const latin1 = Uint8Array.from("Buchungstag;Betrag;Beguenstigter/Zahlungspflichtiger\n01.10.26;-5,00;Bäckerei Müller\n", (c) =>
      c.charCodeAt(0),
    );
    const text = decode(latin1);
    expect(text).toContain("Bäckerei Müller");
    expect(rows(text, "sparkasse").rows[0].payee).toBe("Bäckerei Müller");
  });

  it("Revolut: fees taken off, pending skipped", () => {
    const { rows: r, skipped } = rows(REVOLUT, "revolut");
    expect(r.map((x) => [x.date, x.amount, x.payee])).toEqual([
      ["2026-10-03", -23.4, "Lieferando"],
      ["2026-10-01", 100, "Top-up by *1234"],
      ["2026-10-04", -50.25, "Exchanged to USD"],
    ]);
    expect(skipped[0].reason).toMatch(/PENDING/);
  });

  it("BCA: header lines above the table, DB/CR, year from the period, PEND skipped", () => {
    const m = guessMapping(BCA, "bca");
    expect(m.defaultCurrency).toBe("IDR");
    const { rows: r, skipped } = readRows(BCA, m);
    expect(r.map((x) => [x.date, x.amount, x.currency])).toEqual([
      ["2026-09-05", -1500000, "IDR"],
      ["2026-09-10", 2000000, "IDR"],
    ]);
    expect(r[0].payee).toMatch(/TRSF E-BANKING/);
    expect(skipped.some((s) => /PEND/.test(s.reason))).toBe(true);
  });

  it("PayPal (German export): Brutto/Netto, BOM removed", () => {
    const m = guessMapping(PAYPAL_DE, "paypal");
    expect(m.delimiter).toBe(",");
    const { rows: r } = readRows(PAYPAL_DE, m);
    expect(r.map((x) => [x.date, x.amount, x.payee])).toEqual([
      ["2026-10-04", -59.9, "Zalando SE"],
      ["2026-10-04", 59.9, "Bankgutschrift auf PayPal-Konto"],
      ["2026-10-06", -10.99, "Spotify AB"],
    ]);
  });

  it("Wise: day-month-year with dashes", () => {
    const { rows: r } = rows(WISE, "wise");
    expect(r.map((x) => [x.date, x.amount, x.currency])).toEqual([
      ["2026-10-01", -200, "EUR"],
      ["2026-10-03", -8.5, "EUR"],
    ]);
    expect(r[1].payee).toBe("Backhaus Eichstaett");
  });

  it("a simple three-column card statement (TF Bank)", () => {
    const { rows: r } = rows(TFBANK, "tfbank");
    expect(r.map((x) => [x.date, x.amount, x.payee])).toEqual([
      ["2026-10-02", -34.99, "AMAZON.DE*AB12CD"],
      ["2026-10-05", 150, "Zahlung erhalten - Danke"],
      ["2026-10-07", -62.3, "ARAL STATION 4711"],
    ]);
  });
});

describe("bank import: values", () => {
  it("reads amounts in every common style", () => {
    expect(parseAmount("-1.234,56", ",")).toBe(-1234.56);
    expect(parseAmount("1,234.56", ".")).toBe(1234.56);
    expect(parseAmount("€ -12,50", ",")).toBe(-12.5);
    expect(parseAmount("12.50-", ".")).toBe(-12.5);
    expect(parseAmount("(12.50)", ".")).toBe(-12.5);
    expect(parseAmount("1,500,000.00 DB", ".")).toBe(-1500000);
    expect(parseAmount("", ",")).toBeNull();
  });

  it("reads dates and refuses impossible ones", () => {
    expect(parseDate("03.10.26", "dmy")).toBe("2026-10-03");
    expect(parseDate("2026-10-03 12:00", "dmy")).toBe("2026-10-03");
    expect(parseDate("10/03/2026", "mdy")).toBe("2026-10-03");
    expect(parseDate("31.02.2026", "dmy")).toBeNull();
    expect(parseDate("Saldo", "dmy")).toBeNull();
  });

  it("converts Rupiah with the saved rate", () => {
    expect(toEur(-1_500_000, "IDR", 18000)).toBe(-83.33);
    expect(toEur(-5, "EUR", 18000)).toBe(-5);
    expect(toEur(-5, "USD", 18000)).toBeNull();
  });
});

describe("bank import: no duplicates", () => {
  it("same file twice gives the same fingerprints; identical rows stay separate", async () => {
    const r = rows(SPARKASSE, "sparkasse").rows;
    const a = await rowHashes("sparkasse", r);
    const b = await rowHashes("sparkasse", r);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(r.length); // the two REWE rows differ
  });
});

describe("bank import: categories", () => {
  const cats = [
    { id: "g", name: "Groceries" },
    { id: "o", name: "Online shopping" },
    { id: "e", name: "Eating out" },
    { id: "t", name: "Transport" },
  ];
  const none = new Map<string, string>();

  it("your own rule wins over the built-in names", () => {
    const rules = new Map([[merchantKey("REWE Markt GmbH"), "e"]]);
    expect(suggestCategory({ payee: "REWE Markt GmbH", purpose: "", amount: -5 }, cats, rules, none, []).categoryId).toBe("e");
    expect(suggestCategory({ payee: "REWE Markt GmbH", purpose: "", amount: -5 }, cats, none, none, []).categoryId).toBe("g");
  });

  it("unknown shops are flagged with three suggestions", () => {
    const s = suggestCategory({ payee: "Kunsthandlung Meier", purpose: "", amount: -20 }, cats, none, none, ["g", "e", "o", "t"]);
    expect(s.confidence).toBe("none");
    expect(s.options).toEqual(["g", "e", "o"]);
  });

  it("money between your own accounts is recognised", () => {
    expect(suggestCategory({ payee: "PayPal Europe", purpose: "", amount: -59.9 }, cats, none, none, [], "Sparkasse").transfer).toBe(true);
    expect(suggestCategory({ payee: "Top-up by *1234", purpose: "", amount: 100 }, cats, none, none, [], "Revolut").transfer).toBe(true);
    expect(suggestCategory({ payee: "Zalando SE", purpose: "", amount: -59.9 }, cats, none, none, [], "PayPal").transfer).toBe(false);
    expect(suggestCategory({ payee: "Bankgutschrift auf PayPal-Konto", purpose: "", amount: 59.9 }, cats, none, none, [], "PayPal").transfer).toBe(true);
  });
});
