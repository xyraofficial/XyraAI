import Terminal from "../ide/Terminal";

export default function TerminalExample() {
  return (
    <div className="h-64 w-full border border-border rounded-md overflow-hidden">
      <Terminal
        onCommand={async (command) => {
          console.log("Command executed:", command);
          return `Executed: ${command}`;
        }}
        initialDirectory="~/project"
      />
    </div>
  );
}
