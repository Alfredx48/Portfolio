import ProjectCard from "./ProjectCard";
import ProjectData from "../data/projectData"

function Projects() {

    const projects =
        ProjectData.map((project, index) => (
            <>
                <ProjectCard key={index} project={project} />
            </>
        )
        )

    return (
        <div id="projects">
            {projects}
        </div>
    );
}
export default Projects;