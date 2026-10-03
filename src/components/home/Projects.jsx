import { For, Show } from 'solid-js';
import projectData from '../../data/projectData';

function ProjectCard(props) {
	return (
		<article class="card project-card">
			<img class="project-image" src={props.project.image} alt="" loading="lazy" width="480" height="250" />
			<div class="project-body">
				<h3 class="card-title">
					<a href={props.project.video} target="_blank" rel="noopener noreferrer" class="stretched-link">
						{props.project.name}
						<span class="arrow" aria-hidden="true">
							↗
						</span>
					</a>
				</h3>
				<p>{props.project.description}</p>
				<ul class="chips" aria-label="Technologies">
					<For each={props.project.tech}>{(tech) => <li class="chip">{tech}</li>}</For>
				</ul>
				<div class="card-links">
					<a href={props.project.video} target="_blank" rel="noopener noreferrer">
						Demo video
					</a>
					<Show when={props.project.source}>
						<a href={props.project.source} target="_blank" rel="noopener noreferrer">
							Source
						</a>
					</Show>
				</div>
			</div>
		</article>
	);
}

function Projects() {
	return (
		<section id="projects" class="section" aria-labelledby="projects-heading">
			<h2 id="projects-heading" class="section-heading">
				Projects
			</h2>
			<div class="card-list">
				<For each={projectData}>{(project) => <ProjectCard project={project} />}</For>
			</div>
		</section>
	);
}

export default Projects;
