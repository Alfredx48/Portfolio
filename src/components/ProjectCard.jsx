
function ProjectCard({ image, name, description, video }) {

    return (
        <a rel="noopener noreferrer nofollow"
            target="_blank" href={video}>
            <div id="project-card">
                <div id="project-img-h1">
                    <h1 id="project-name">{name}</h1>
                    <img src={image} alt={name} id="project-img" />
                </div>
                <p>{description}</p>
            </div>
        </a>
    );
}
export default ProjectCard;