import { buildTrustMonitoringSnapshot } from "@/lib/trust/trustMonitoringSnapshot"
import TrustMonitoringLiveClient from "./TrustMonitoringLiveClient"

export default async function TrustMonitoringPage() {
  const snapshot = await buildTrustMonitoringSnapshot(120)
  return <TrustMonitoringLiveClient initialSnapshot={snapshot} />
}
