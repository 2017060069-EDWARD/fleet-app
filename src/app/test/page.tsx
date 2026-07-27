import ExpenseLogger from '@/components/ExpenseLogger'

export default function TestPage() {
  // We use a dummy UUID for tripId to satisfy the database reference requirement
  const dummyTripId = '00000000-0000-0000-0000-000000000000'

  return (
    <main className="min-h-screen bg-slate-950 p-8 flex flex-col items-center justify-center text-white">
      <h1 className="text-2xl font-bold mb-6">Boulevard Logistics — System Test</h1>
      <ExpenseLogger tripId={dummyTripId} />
    </main>
  )
}