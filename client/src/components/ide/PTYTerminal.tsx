import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as TerminalIcon, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import "@xterm/xterm/css/xterm.css";

interface PTYTerminalProps {
  initialDirectory?: string;
}

export default function PTYTerminal({ initialDirectory = "" }: PTYTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    setReconnecting(true);
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      if (xtermRef.current) {
        xtermRef.current.clear();
        xtermRef.current.writeln("\x1b[32mConnected to interactive shell\x1b[0m");
        xtermRef.current.writeln("\x1b[90mYou can run interactive commands like 'python menu.py'\x1b[0m");
        xtermRef.current.writeln("");
      }
      
      // Send initial resize
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "output":
            xtermRef.current?.write(msg.data);
            break;
          case "exit":
            xtermRef.current?.writeln(`\r\n\x1b[33mProcess exited with code ${msg.exitCode}\x1b[0m`);
            setConnected(false);
            // Auto reconnect after exit
            setTimeout(() => connect(), 1000);
            break;
          case "session":
            // Session established
            break;
        }
      } catch (e) {
        // Raw output
        xtermRef.current?.write(event.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setReconnecting(false);
      xtermRef.current?.writeln("\r\n\x1b[31mDisconnected from shell\x1b[0m");
    };

    ws.onerror = () => {
      setConnected(false);
      setReconnecting(false);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
        cursorAccent: "#1a1b26",
        selectionBackground: "#33467c",
        black: "#15161e",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#a9b1d6",
        brightBlack: "#414868",
        brightRed: "#f7768e",
        brightGreen: "#9ece6a",
        brightYellow: "#e0af68",
        brightBlue: "#7aa2f7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle terminal input
    terminal.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
    };

    window.addEventListener("resize", handleResize);
    
    // ResizeObserver for container changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(terminalRef.current);

    // Connect to WebSocket
    connect();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      terminal.dispose();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <div className="flex flex-col h-full bg-[#1a1b26]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-background/80 border-b border-border">
        <TerminalIcon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium">Interactive Terminal (PTY)</span>
        <div className={`w-2 h-2 rounded-full ml-2 ${connected ? "bg-green-500" : reconnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
        <span className="text-xs text-muted-foreground">
          {connected ? "Connected" : reconnecting ? "Connecting..." : "Disconnected"}
        </span>
        
        <div className="flex items-center gap-1 ml-auto">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={reconnect}
            title="Reconnect"
            data-testid="button-reconnect-terminal"
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {/* Terminal container */}
      <div 
        ref={terminalRef} 
        className="flex-1 p-1"
        data-testid="pty-terminal"
      />
    </div>
  );
}
