type AgentConsoleListener = (log: AgentLog) => void;

export interface AgentLog {
  id: string;
  type: "command" | "output" | "error" | "info";
  content: string;
  timestamp: Date;
}

class AgentConsoleEmitter {
  private listeners: AgentConsoleListener[] = [];
  private logs: AgentLog[] = [];

  subscribe(listener: AgentConsoleListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(type: AgentLog["type"], content: string) {
    const log: AgentLog = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date(),
    };
    this.logs.push(log);
    this.listeners.forEach(l => l(log));
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const agentConsole = new AgentConsoleEmitter();
