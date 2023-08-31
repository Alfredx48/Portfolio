import { createSignal } from "solid-js";

// Import the CSS
import "../css/GetInTouch.css";
import { A } from "@solidjs/router";

function GetInTouchButton() {
  // You can use Solid.js signals or stores here if needed
  const [clicked, setClicked] = createSignal(false);

  const handleClick = () => {
    setClicked(true);
    // Handle the click event, e.g., navigate to the contact form
  };

  return (
    <A id="hidden"
      href="/contact"
      activeClass="underlined">
      <button class="get-in-touch" onClick={handleClick}>
        Get in Touch
      </button>
    </A>
  );
}

export default GetInTouchButton;
