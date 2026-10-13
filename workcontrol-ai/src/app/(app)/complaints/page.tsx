"use client";

import CategoryPage from "@/components/CategoryPage";
import { COMPLAINT_CATEGORIES, COMPLAINT_STAGES } from "@/lib/constants";

export default function Complaints() {
  return (
    <CategoryPage
      title="Рекламации"
      hint="Рекламации клиентов и претензии к перевозчикам UPS / DPD."
      categories={COMPLAINT_CATEGORIES}
      stages={COMPLAINT_STAGES}
      newCategory="complaint"
      doneStages={["resolved"]}
    />
  );
}
