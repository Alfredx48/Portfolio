import { onMount, onCleanup } from "solid-js";
import MyLogo from "/src/assets/my-logo1.png"

function Logo() {
    let logo;
    
    const startAnimation = () => {
        logo.style.animationPlayState = 'running';
    }

    onMount(() => {
        const timer = setTimeout(startAnimation,1000);
        onCleanup(() => clearTimeout(timer));
    });

    return (
        <div id="logo" ref={el => (logo = el)}>
            <img id="img-logo" src={MyLogo} alt="logo"  />
        </div>
    );
}

export default Logo;
