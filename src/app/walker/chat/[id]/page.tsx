import PortalChat from "@/components/portal-chat";

export default async function WalkerChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalChat role="walker" conversationId={id} />;
}
