import { useSearch } from "@tanstack/react-router";
import { useClasses } from "@/hooks/use-academy-data";
import { useAcademy } from "./academy-context";

export function useClassSelection() {
  const classesQuery = useClasses();
  const search = useSearch({ from: "/app/$role/$page" });
  const { navigate, page } = useAcademy();
  const primaryClass = search.classId
    ? classesQuery.data?.find((item) => item.id === search.classId)
    : classesQuery.data?.[0];
  const selector = (
    <label className="mb-5 block text-sm">
      Groupe
      <select className="mt-1 block w-full rounded-md border bg-background p-2"
        value={primaryClass?.id ?? ""}
        onChange={(event) => navigate(page, { classId: event.target.value })}>
        <option value="" disabled>Choisir un groupe</option>
        {classesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
  );
  return { classesQuery, primaryClass, selector };
}
