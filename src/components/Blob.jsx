import { createSignal, createEffect, onCleanup } from 'solid-js';
import "../css/Blob.css"

function Blob() {
  const [blob, setBlob] = createSignal(); // use a Solid signal as a ref
  let animationFrameId;  // Declare a variable to hold the requestAnimationFrame ID

  const handlePointerMove = event => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId); // Cancel any existing animation frames
    }
  
    animationFrameId = requestAnimationFrame(() => { // Schedule a new animation frame
      const clientX = event.clientX + window.scrollX;
      const clientY = event.clientY + window.scrollY;

      const blobElement = blob();
      if (blobElement) {
        blobElement.style.left = `${clientX}px`;
        blobElement.style.top = `${clientY}px`;
      }
    });
  };

  createEffect(() => {
    // add event listener on effect creation
    window.addEventListener('pointermove', handlePointerMove);

    // remove event listener on effect cleanup
    onCleanup(() => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // Cancel any remaining animation frames
      }
    });
  });

  return (
    <div id="blob" ref={setBlob}></div> // pass the setter of the signal as the ref
  );
}

export default Blob;
