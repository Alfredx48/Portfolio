import { For } from 'solid-js';
import github from '../../assets/github.png';
import linkedIn from '../../assets/linkedin.png';
import resumeIcon from '../../assets/resumewhite.png';
import resumePdf from '../../assets/Resume.pdf';

const links = [
	{ href: resumePdf, icon: resumeIcon, label: 'Résumé (PDF)' },
	{ href: 'https://github.com/Alfredx48', icon: github, label: 'GitHub' },
	{ href: 'https://www.linkedin.com/in/alfredx48/', icon: linkedIn, label: 'LinkedIn' },
];

function Socials() {
	return (
		<ul class="socials">
			<For each={links}>
				{(link) => (
					<li>
						<a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}>
							<img src={link.icon} alt="" width="32" height="32" />
						</a>
					</li>
				)}
			</For>
		</ul>
	);
}

export default Socials;
