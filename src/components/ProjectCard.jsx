
function ProjectCard({ project }) {

    const {image, name, description} = project
    return (
        <div id="project-card">
            <img src={image} alt={name} id="project-img" />
            <h1 id="name">{name}</h1>
            <p>{description}</p>
        </div>
    );
}
export default ProjectCard;