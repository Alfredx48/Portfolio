import emailjs from "@emailjs/browser";
import "../css/Contact.css";
import Logo from "./Logo";
import { A } from "@solidjs/router";

function Contact() {

  let form;

  const sendEmail = e => {
    e.preventDefault();

    emailjs.sendForm(
      "service_vysbmr8",
      "template_v2qnv8p",
      form,
      "cWZHoBRw_PR2wBlwi"
    )
      .then(
        (result) => {
          console.log(result.text);
          form.reset();
        },
        (error) => {
          console.log(error.text)
        }
      )
  }
  return (
    <>
      <A id="hidden"
        href="/"
        activeClass="underlined"> <Logo /> </A>
      <div>
        <h1 class="header">Send Me an Email</h1>
        <form
          class="contact-form"
          ref={form}
          onSubmit={sendEmail}
        >
          <label class="contact-label">Name</label>
          <input autocomplete="false" required class="contact-input" type="text" name="user_name" />
          <label class="contact-label">Email</label>
          <input required class="contact-input" type="email" name="user_email" />
          <label class="contact-label">Message</label>
          <textarea required class="contact-input" name="message"></textarea>
          <button class="submit" type="submit" value="Send"> Send </button>
          <A id="home" href="/" activeClass="underlined">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <g transform="rotate(180, 25, 25)">
                <path d="M 10 25 L 40 25" stroke="black" stroke-width="2" fill="none"></path>
                <path d="M 30 15 L 40 25 L 30 35" stroke="black" stroke-width="2" fill="none"></path>
              </g>
            </svg>
            <p>Home</p>
          </A>
        </form>
      </div>
    </>
  );
};

export default Contact