import { describe, expect, test } from "vitest";
import { getSupplierOrderIssues } from "../lib/supplierOrderValidation";

describe("getSupplierOrderIssues", () => {
  const sampleSupplierProducts = [
    {
      id: "prod-okna",
      name: "Okna",
      isActive: true,
      questions: [
        { id: "q-1", question: "Kolor profilu" },
        { id: "q-2", question: "Pakiet szybowy" },
      ],
    },
    {
      id: "prod-brama",
      name: "Brama",
      isActive: false,
      questions: [{ id: "q-3", question: "Napęd" }],
    },
  ];

  test("returns supplier issue when netAmount is missing or <= 0", () => {
    const issuesZero = getSupplierOrderIssues({
      netAmount: 0,
      selectedProducts: [
        {
          id: "prod-okna",
          name: "Okna",
          answers: [
            { questionId: "q-1", question: "Kolor profilu", answer: "RAL 7016" },
            { questionId: "q-2", question: "Pakiet szybowy", answer: "3-szybowy" },
          ],
        },
      ],
      supplierProducts: sampleSupplierProducts,
    });
    expect(issuesZero).toEqual([
      { step: "supplier", message: "Uzupełnij kwotę netto (musi być większa od 0)" },
    ]);

    const issuesMissing = getSupplierOrderIssues({
      netAmount: undefined,
      selectedProducts: [],
      supplierProducts: [],
    });
    expect(issuesMissing).toHaveLength(1);
    expect(issuesMissing[0].step).toBe("supplier");
  });

  test("returns products issue when supplier has active products and none is selected", () => {
    const issues = getSupplierOrderIssues({
      netAmount: 5000,
      selectedProducts: [],
      supplierProducts: sampleSupplierProducts,
    });
    expect(issues).toEqual([
      { step: "products", message: "Wybierz co najmniej jeden produkt" },
    ]);
  });

  test("does not require product selection when supplier has no active products", () => {
    const issues = getSupplierOrderIssues({
      netAmount: 5000,
      selectedProducts: [],
      supplierProducts: [sampleSupplierProducts[1]],
    });
    expect(issues).toEqual([]);
  });

  test("returns products issue when selected product has missing or whitespace-only answer", () => {
    const issues = getSupplierOrderIssues({
      netAmount: 5000,
      selectedProducts: [
        {
          id: "prod-okna",
          name: "Okna",
          answers: [
            { questionId: "q-1", question: "Kolor profilu", answer: "RAL 7016" },
            { questionId: "q-2", question: "Pakiet szybowy", answer: "   " },
          ],
        },
      ],
      supplierProducts: sampleSupplierProducts,
    });
    expect(issues).toEqual([
      { step: "products", message: "Okna: brak odpowiedzi na „Pakiet szybowy”" },
    ]);
  });

  test("returns empty list when netAmount > 0, product is selected, and all questions are answered", () => {
    const issues = getSupplierOrderIssues({
      netAmount: 12500,
      selectedProducts: [
        {
          id: "prod-okna",
          name: "Okna",
          answers: [
            { questionId: "q-1", question: "Kolor profilu", answer: "RAL 7016" },
            { questionId: "q-2", question: "Pakiet szybowy", answer: "3-szybowy" },
          ],
        },
      ],
      supplierProducts: sampleSupplierProducts,
    });
    expect(issues).toEqual([]);
  });

  test("validates each question by questionId even when multiple questions share the same label", () => {
    const issues = getSupplierOrderIssues({
      netAmount: 1000,
      selectedProducts: [
        {
          id: "prod-dup",
          name: "Okna",
          answers: [
            { questionId: "q-a", question: "test", answer: "odpowiedz 1" },
            { questionId: "q-b", question: "test", answer: "" },
          ],
        },
      ],
      supplierProducts: [
        {
          id: "prod-dup",
          name: "Okna",
          isActive: true,
          questions: [
            { id: "q-a", question: "test" },
            { id: "q-b", question: "test" },
          ],
        },
      ],
    });
    expect(issues).toEqual([
      { step: "products", message: "Okna: brak odpowiedzi na „test”" },
    ]);
  });

  test("validates number answerType and accepts select/boolean string values", () => {
    const invalidNumberIssues = getSupplierOrderIssues({
      netAmount: 1000,
      selectedProducts: [
        {
          id: "prod-typed",
          name: "Okna",
          answers: [
            { questionId: "q-num", question: "Szerokość", answer: "abc" },
            { questionId: "q-sel", question: "Kolor", answer: "RAL 7016" },
            { questionId: "q-bool", question: "Montaż", answer: "Tak" },
          ],
        },
      ],
      supplierProducts: [
        {
          id: "prod-typed",
          name: "Okna",
          isActive: true,
          questions: [
            { id: "q-num", question: "Szerokość", answerType: "number" },
            { id: "q-sel", question: "Kolor", answerType: "select", options: ["RAL 7016", "Biały"] },
            { id: "q-bool", question: "Montaż", answerType: "boolean" },
          ],
        },
      ],
    });
    expect(invalidNumberIssues).toEqual([
      { step: "products", message: "Okna: odpowiedź na „Szerokość” musi być liczbą" },
    ]);

    const validIssues = getSupplierOrderIssues({
      netAmount: 1000,
      selectedProducts: [
        {
          id: "prod-typed",
          name: "Okna",
          answers: [
            { questionId: "q-num", question: "Szerokość", answer: "120.5" },
            { questionId: "q-sel", question: "Kolor", answer: "RAL 7016" },
            { questionId: "q-bool", question: "Montaż", answer: "Tak" },
          ],
        },
      ],
      supplierProducts: [
        {
          id: "prod-typed",
          name: "Okna",
          isActive: true,
          questions: [
            { id: "q-num", question: "Szerokość", answerType: "number" },
            { id: "q-sel", question: "Kolor", answerType: "select", options: ["RAL 7016", "Biały"] },
            { id: "q-bool", question: "Montaż", answerType: "boolean" },
          ],
        },
      ],
    });
    expect(validIssues).toEqual([]);
  });
});
