import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useAgentStore } from '../../store/agentStore'

interface TerminalProps {
  agentId: string
}

const Terminal: React.FC<TerminalProps> = ({ agentId }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const inputBuffer = useRef<string>('')
  
  const { 
    logs, 
    appendLog, 
    agentClipboard, 
    setClipboard, 
    setActiveAgent,
    sendDelegate,
    sendForward
  } = useAgentStore()

  const agentIdRef = useRef(agentId)
  const logsRef = useRef(logs)
  const clipboardRef = useRef(agentClipboard)
  const setClipboardRef = useRef(setClipboard)
  const appendLogRef = useRef(appendLog)
  const setActiveAgentRef = useRef(setActiveAgent)
  const sendDelegateRef = useRef(sendDelegate)
  const sendForwardRef = useRef(sendForward)

  useEffect(() => { agentIdRef.current = agentId }, [agentId])
  useEffect(() => { logsRef.current = logs }, [logs])
  useEffect(() => { clipboardRef.current = agentClipboard }, [agentClipboard])
  useEffect(() => { setClipboardRef.current = setClipboard }, [setClipboard])
  useEffect(() => { appendLogRef.current = appendLog }, [appendLog])
  useEffect(() => { setActiveAgentRef.current = setActiveAgent }, [setActiveAgent])
  useEffect(() => { sendDelegateRef.current = sendDelegate }, [sendDelegate])
  useEffect(() => { sendForwardRef.current = sendForward }, [sendForward])

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 12,
      theme: {
        background: '#050505',
        foreground: '#cccccc',
        cursor: '#4ADE80',
        selectionBackground: 'rgba(74, 222, 128, 0.3)',
      },
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    term.onData((data) => {
      const currentAgentId = agentIdRef.current
      if (data === '\r') {
        term.write('\r\n')
        handleCommand(inputBuffer.current, currentAgentId)
        inputBuffer.current = ''
      } else if (data === '\u007F') {
        if (inputBuffer.current.length > 0) {
          inputBuffer.current = inputBuffer.current.slice(0, -1)
          term.write('\b \b')
        }
      } else if (data === '\u0003') {
        term.write('^C\r\n')
        inputBuffer.current = ''
      } else {
        inputBuffer.current += data
        term.write(data)
      }
    })
    
    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type === 'keydown' && ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'c') {
        const selection = term.getSelection()
        if (selection) setClipboardRef.current(selection)
        return false
      }
      if (ev.type === 'keydown' && ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === 'v') {
        const content = clipboardRef.current
        if (content) {
            inputBuffer.current += content
            term.write(content)
        }
        return false
      }
      return true
    })

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)
    term.write(`\r\n\x1b[32m${agentIdRef.current}@copernicus\x1b[0m:~$ `)

    return () => {
      term.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, []) 

  useEffect(() => {
    if (!xtermRef.current) return
    const term = xtermRef.current
    term.clear()
    const agentLogs = logs[agentId] || []
    agentLogs.forEach(log => {
      term.writeln(log.content)
    })
    term.write(`\r\n\x1b[32m${agentId}@copernicus\x1b[0m:~$ `)
    term.write(inputBuffer.current)
    fitAddonRef.current?.fit()
  }, [agentId, logs]) 

  const handleCommand = (cmd: string, currentAgentId: string) => {
    let expandedCmd = cmd
    expandedCmd = expandedCmd.replace(/@last-(\w+)/g, (_match, targetAgent) => {
        const agentLogs = logsRef.current[targetAgent] || []
        const outputLogs = agentLogs.filter(l => l.source === 'stdout')
        return outputLogs.slice(-5).map(l => l.content).join('\n') || `[No output from ${targetAgent}]`
    })

    const trimmed = expandedCmd.trim()
    if (trimmed.startsWith('/delegate')) {
      const match = trimmed.match(/\/delegate\s+agent=(\w+)\s+task="([^"]+)"/)
      if (match) {
        const [_, targetAgent, task] = match
        appendLogRef.current(currentAgentId, `Delegate to ${targetAgent}: ${task}`, 'stdout')
        setActiveAgentRef.current(targetAgent)
        sendDelegateRef.current(targetAgent, task)
      }
    } else if (trimmed.startsWith('/forward')) {
        const match = trimmed.match(/\/forward\s+agent=(\w+)/)
        if (match) {
            const [_, targetAgent] = match
            const myLogs = logsRef.current[currentAgentId] || []
            const lastLines = myLogs.slice(-5).map(l => l.content).join('\n')
            appendLogRef.current(currentAgentId, `Forwarding context to ${targetAgent}...`, 'stdout')
            setActiveAgentRef.current(targetAgent)
            sendForwardRef.current(targetAgent, lastLines)
        }
    } else if (trimmed !== '') {
        appendLogRef.current(currentAgentId, `> ${trimmed}`, 'stdin')
        setTimeout(() => {
           appendLogRef.current(currentAgentId, `Response to: ${trimmed}`, 'stdout')
        }, 50)
    }
  }

  return (
    <div className="w-full h-full bg-[#050505] p-2" ref={terminalRef} />
  )
}

export default Terminal
