import logo from '../assets/logo.webp';
import './shell.css';

// Only a visit that lands on the home page gets the intro animation
const playIntro = window.location.pathname === '/';

function Logo() {
	return <img class="logo" classList={{ "logo-animated": playIntro }} src={logo} alt="" width="64" height="64" />;
}

export default Logo;
