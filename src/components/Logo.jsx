import { onMount, onCleanup } from "solid-js";

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
            <img id="img-logo" src="./src/assets/my-logo1.png" alt="logo"  />
        </div>
    );
}

export default Logo;
