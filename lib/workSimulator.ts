export function generateSimulation() {
  const scenarios = [
    {
      client: "John",
      task: "Schedule meeting for next Monday"
    },

    {
      client: "Marketing Team",
      task: "Prepare weekly performance report"
    },

    {
      client: "Sales Manager",
      task: "Update CRM contacts"
    }
  ]

  return scenarios[
    Math.floor(Math.random() * scenarios.length)
  ]
}
