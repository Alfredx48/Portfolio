import mardinis from '../assets/projects/mardinis.webp';
import cuisine from '../assets/projects/cuisine-creations.webp';
import semiGames from '../assets/projects/semi-addicting-games.webp';

// `source` is optional; a card only shows the links it has.
const projectData = [
	{
		name: 'Mardinis Restaurant',
		image: mardinis,
		video: 'https://youtu.be/tqz7GvuO9bE',
		description:
			'An online ordering site for a restaurant. Customers browse the menu and place orders; a Rails API handles sessions and RESTful order routes, and the React frontend uses Framer Motion for page transitions.',
		tech: ['React', 'Ruby on Rails', 'Framer Motion', 'Sessions & Cookies', 'REST', 'Netlify'],
	},
	{
		name: 'Semi-Addicting Games',
		image: semiGames,
		video: 'https://youtu.be/InGj8cHPd88',
		source: 'https://github.com/Alfredx48/semi-addicting-games',
		description:
			'A single-page app that puts tic-tac-toe and hangman in one place, with client-side routing between games, styled-components for theming and Framer Motion animations.',
		tech: ['React', 'React Router', 'styled-components', 'Framer Motion', 'Render'],
	},
	{
		name: 'Cuisine Creations',
		image: cuisine,
		video: 'https://youtu.be/4Voi-xZwils',
		description:
			'A recipe-sharing community. Signed-in users create and edit recipes with ingredients, steps and measurements, and browse what others have shared. Rails and PostgreSQL on the backend, React on the front.',
		tech: ['React', 'Ruby on Rails', 'PostgreSQL', 'styled-components', 'Authentication'],
	},
];

export default projectData;
