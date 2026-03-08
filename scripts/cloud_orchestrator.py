import argparse
from ollama import Client as OllamaClient

# Configuration for the Dell Server
DELL_SERVER_URL = "http://192.168.1.185:11434"

class CloudOrchestrator:
    def __init__(self, host=DELL_SERVER_URL):
        self.client = OllamaClient(host=host)
        self.agents = {
            "coder": "qwen3-coder-next:cloud",
            "thinker": "kimi-k2-thinking:cloud",
            "vision": "qwen3-vl:cloud",
            "general": "deepseek-v3.2:cloud",
            "fast": "gemini-3-flash-preview:cloud"
        }

    def call_agent(self, agent_type, prompt, stream=True):
        model = self.agents.get(agent_type, self.agents["general"])
        print(f"--- [Cloud Agent: {agent_type} ({model})] ---")
        
        response = self.client.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            stream=stream
        )
        
        full_response = ""
        if stream:
            for chunk in response:
                content = chunk['message']['content']
                print(content, end='', flush=True)
                full_response += content
            print("\n")
        else:
            full_response = response['message']['content']
            print(full_response)
            
        return full_response

    def multi_agent_task(self, task_description):
        """
        Example of orchestration:
        1. Thinker plans the task.
        2. Coder implements/reviews.
        3. General agent summarizes.
        """
        print(f"Starting Multi-Agent Orchestration for: {task_description}\n")
        
        # Phase 1: Planning
        plan_prompt = f"Create a detailed technical plan for the following task: {task_description}"
        plan = self.call_agent("thinker", plan_prompt)
        
        # Phase 2: Implementation/Review
        exec_prompt = f"Based on this plan:\n{plan}\n\nExecute or provide the code for: {task_description}"
        result = self.call_agent("coder", exec_prompt)
        
        # Phase 3: Final Summary
        summary_prompt = f"Summarize the following implementation and provide next steps:\n{result}"
        summary = self.call_agent("general", summary_prompt)
        
        return summary

def main():
    parser = argparse.ArgumentParser(description="Copernicus Cloud Agent Orchestrator")
    parser.add_argument("prompt", help="The task or prompt for the cloud agents")
    parser.add_argument("--agent", choices=["coder", "thinker", "vision", "general", "fast"], default="general")
    parser.add_argument("--multi", action="store_true", help="Run as a multi-agent orchestrated task")
    
    args = parser.parse_args()
    
    orchestrator = CloudOrchestrator()
    
    if args.multi:
        orchestrator.multi_agent_task(args.prompt)
    else:
        orchestrator.call_agent(args.agent, args.prompt)

if __name__ == "__main__":
    main()
