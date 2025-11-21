export const parseDashboardData = (data) => {
  if (!data) return [];

  // Example: transform API data into UI-friendly format
  return (
    data.items?.map((item) => ({
      id: item.id,
      title: item.name,
      value: item.value,
    })) || []
  );
};
