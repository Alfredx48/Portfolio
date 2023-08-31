import ProjectCard from "./ProjectCard";
import ProjectData from "../data/projectData"

function Projects() {

    const projects = ProjectData.map(({ image, name, video ,description }, index) => (
        <ProjectCard key={index} image={image} name={name} video={video} description={description}/>
    ));

    return (
        <div id="projects">
            {projects}
        </div>
    );
}
export default Projects;