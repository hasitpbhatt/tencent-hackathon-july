from crewai import Agent, Crew, Process, Task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai.project import CrewBase, agent, crew, task

from agents._lib.llm import get_llm


@CrewBase
class PlanningCrew:
    """Four-agent document generation: PM writes PRD → TL writes Tech Spec
    → Designer writes Design Spec → Reviewer suggests.

    TL reads PRD via Task.context; Designer reads PRD + Tech Spec;
    Reviewer reads all three via Task.context and suggests improvements.
    """

    agents: list[BaseAgent]
    tasks: list[Task]

    agents_config = "../agents.yaml"
    tasks_config = "config/tasks.yaml"

    @agent
    def product_manager(self) -> Agent:
        return Agent(
            config=self.agents_config["product_manager"],
            llm=get_llm(),
            memory=False,
        )

    @agent
    def tech_lead(self) -> Agent:
        return Agent(
            config=self.agents_config["tech_lead"],
            llm=get_llm(),
            memory=False,
        )

    @agent
    def designer(self) -> Agent:
        return Agent(
            config=self.agents_config["designer"],
            llm=get_llm(),
            memory=False,
        )

    @agent
    def reviewer(self) -> Agent:
        return Agent(
            config=self.agents_config["reviewer"],
            llm=get_llm(),
            memory=False,
        )

    @task
    def write_prd(self) -> Task:
        """PM writes the PRD."""
        return Task(
            config=self.tasks_config["pm_write_prd"],
            agent=self.product_manager(),
        )

    @task
    def write_spec(self) -> Task:
        """TL reads PRD (via context) and writes Tech Spec."""
        return Task(
            config=self.tasks_config["tl_write_spec"],
            agent=self.tech_lead(),
            context=[self.write_prd()],
        )

    @task
    def write_design(self) -> Task:
        """Designer reads PRD + Tech Spec (via context) and writes Design Spec."""
        return Task(
            config=self.tasks_config["designer_write_spec"],
            agent=self.designer(),
            context=[self.write_prd(), self.write_spec()],
        )

    @task
    def review_suggest(self) -> Task:
        """Reviewer reads all three documents and suggests next actions."""
        return Task(
            config=self.tasks_config["review_suggest"],
            agent=self.reviewer(),
            context=[self.write_prd(), self.write_spec(), self.write_design()],
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True, # Set to True for debugging
        )
