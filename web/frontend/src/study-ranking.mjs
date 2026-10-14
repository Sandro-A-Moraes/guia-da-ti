export const studyTypes = new Set([
  "courses",
  "platforms",
  "universities",
  "bootcamps",
  "roadmaps",
  "books",
  "certifications",
]);

export const studySorts = {
  hypes: "Mais hypado",
  comments: "Mais comentado",
  interactions: "Mais interagido",
  rating: "Melhor avaliado",
};

export const studyKey = (r) => `${r.type}/${r.slug}`;

export const interactions = (a) =>
  a.comments === null ? null : a.comments + a.hypes + a.ratings;

export function rankStudy(items, activity, sort) {
  const value = (r) => {
    const a = activity[studyKey(r)];
    if (!a) return 0;
    return sort === "rating"
      ? (a.average ?? 0)
      : sort === "interactions"
        ? (interactions(a) ?? 0)
        : (a[sort] ?? 0);
  };
  return [...items].sort(
    (a, b) =>
      value(b) - value(a) ||
      (sort === "rating"
        ? (activity[studyKey(b)]?.ratings ?? 0) -
          (activity[studyKey(a)]?.ratings ?? 0)
        : 0) ||
      a.name.localeCompare(b.name, "pt-BR") ||
      studyKey(a).localeCompare(studyKey(b)),
  );
}
