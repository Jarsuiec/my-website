"use client";

import CategoryPage from "@/components/CategoryPage";
import { RETURN_CATEGORIES, RETURN_STAGES } from "@/lib/constants";

export default function Returns() {
  return (
    <CategoryPage
      title="Возвраты"
      hint="Обратные этикетки, заборы курьером, поступление товара на склад. Меняйте этап — так видно, что ещё не пришло."
      categories={RETURN_CATEGORIES}
      stages={RETURN_STAGES}
      newCategory="return"
      doneStages={["received", "refunded"]}
    />
  );
}
