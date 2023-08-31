
function ProjectCard({ project }) {

    const {image, name, description} = project
    return (
    <div id="project-card">
        <div id="project-img-h1">
            <h1 id="name">{name}</h1>
            <img src={image} alt={name} id="project-img" />
        </div>
            <p>{description}</p>
    </div>
    );
}
export default ProjectCard;