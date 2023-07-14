import { createSignal, createEffect, onCleanup } from 'solid-js';
import "../css/Blob.css"
function Blob() {
  const [blob, setBlob] = createSignal(); // use a Solid signal as a ref

  createEffect(() => {
    const handlePointerMove = event => {
      const { clientX, clientY } = event;

      // modify the CSS directly
      const blobElement = blob(); // get the current value of the blob signal
      if (blobElement) {
        blobElement.style.left = `${clientX}px`;
        blobElement.style.top = `${clientY}px`;
      }
    };

    // add event listener on effect creation
    window.addEventListener('pointermove', handlePointerMove);

    // remove event listener on effect cleanup
    onCleanup(() => {
      window.removeEventListener('pointermove', handlePointerMove);
    });
  });

  return (
    <div id="blob" ref={setBlob}></div> // pass the setter of the signal as the ref
  );
}

export default Blob;
