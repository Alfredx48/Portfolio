import "../css/foundMessageContainer.css"
import { createEffect, onCleanup, createSignal } from 'solid-js';

function FoundMessageContainer() {
    const [isVisible, setIsVisible] = createSignal(true);
    const [showTab, setShowTab] = createSignal(false);

    createEffect(() => {
        // Hide the message after 10 seconds and show the tab
        const timer = setTimeout(() => {
            setIsVisible(false);
            setShowTab(true);
        }, 15000);

        // Cleanup function to clear the timer when the component is unmounted
        onCleanup(() => {
            clearTimeout(timer);
        });
    });

    return (
        <>
            <div id="hidden-message-container" style={{ display: isVisible() ? 'block' : 'none' }}>
                <svg id="x" onClick={() => {
                    setIsVisible(false);
                    setShowTab(true);
                }} fill="#b22222" height="40px" width="40px" viewBox="0 0 460.775 460.775" space="preserve">
                    <path d="M285.08,230.397L456.218,59.27c6.076-6.077,6.076-15.911,0-21.986L423.511,4.565c-2.913-2.911-6.866-4.55-10.992-4.55  c-4.127,0-8.08,1.639-10.993,4.55l-171.138,171.14L59.25,4.565c-2.913-2.911-6.866-4.55-10.993-4.55  c-4.126,0-8.08,1.639-10.992,4.55L4.558,37.284c-6.077,6.075-6.077,15.909,0,21.986l171.138,171.128L4.575,401.505  c-6.074,6.077-6.074,15.911,0,21.986l32.709,32.719c2.911,2.911,6.865,4.55,10.992,4.55c4.127,0,8.08-1.639,10.994-4.55  l171.117-171.12l171.118,171.12c2.913,2.911,6.866,4.55,10.993,4.55c4.128,0,8.081-1.639,10.992-4.55l32.709-32.719  c6.074-6.075,6.074-15.909,0-21.986L285.08,230.397z" />
                </svg>

                <h1 id="hello"> Attention:  </h1>
                <h1 id="found-message">Congrats on finding one of many hidden games!</h1>
                <p>Click the purple logo in the top-left corner to go back home.</p>
            </div>

            <div id="show-message-tab" style={{ display: showTab() ? 'block' : 'none' }}
                onClick={() => {
                    setIsVisible(true);
                    setShowTab(false);
                }}>
                <span>Show Message</span>
            </div>
        </>
    );
}

export default FoundMessageContainer;
