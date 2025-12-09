import AIChat from "../ide/AIChat";

export default function AIChatExample() {
  return (
    <div className="h-[500px] w-80 border border-border rounded-md overflow-hidden">
      <AIChat
        apiConnected={true}
        onSendMessage={async (message) => {
          console.log("Message sent:", message);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return `This is a response to: "${message.slice(0, 50)}..."`;
        }}
      />
    </div>
  );
}
