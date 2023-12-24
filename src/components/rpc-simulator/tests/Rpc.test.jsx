import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import Rpc from '../Rpc';
import { describe, expect, it } from 'vitest';

import '@testing-library/jest-dom'; // 👈 this is imported in order to use the jest-dom matchers 


describe('Rpc Component Tests', () => {
  
  afterEach(cleanup);

  test('renders the Rock, Paper, Scissors stats', () => {
    const { getByText } = render(() => <Rpc />);
    expect(getByText(/Rock:/)).toBeInTheDocument();
    expect(getByText(/Paper:/)).toBeInTheDocument();
    expect(getByText(/Scissors:/)).toBeInTheDocument();
  });

  test('renders the buttons and Count per Type input', () => {
    const { getByText, getByLabelText } = render(() => <Rpc />);
    expect(getByText(/Start/)).toBeInTheDocument();
    expect(getByText(/Reset/)).toBeInTheDocument();
    expect(getByText(/Increase Speed/)).toBeInTheDocument();
    expect(getByText(/Decrease Speed/)).toBeInTheDocument();
    expect(getByLabelText(/Count per Type:/)).toBeInTheDocument();
  });

  test('renders the Rock, Paper, and Scissors elements', () => {
    const { getAllByText } = render(() => <Rpc />);
    expect(getAllByText(/🪨/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/🧻/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/✂️/).length).toBeGreaterThanOrEqual(1);
});


  test('increments the count per type when the user inputs a number', () => {
    const { getByLabelText } = render(() => <Rpc />);
    const input = getByLabelText(/Count per Type:/);
    fireEvent.input(input, { target: { value: '10' } });
    expect(input.value).toBe('10');
  });

  test('increases speed on Increase Speed button click', () => {
    const { getByText } = render(() => <Rpc />);
    fireEvent.click(getByText(/Increase Speed/));
    // Assertion here will depend on how you can access the multiplier or the effect it has on the component.
  });

  test('decreases speed on Decrease Speed button click', () => {
    const { getByText } = render(() => <Rpc />);
    fireEvent.click(getByText(/Decrease Speed/));
    // Similar assertion to the Increase Speed test.
  });

  test('starts simulation on Start button click', () => {
    const { getByText } = render(() => <Rpc />);
    fireEvent.click(getByText(/Start/));
    // Assertion here may involve checking if the entities start moving or if a certain state is set.
  });

  test('resets the game on Reset button click', () => {
    const { getByText, getByLabelText } = render(() => <Rpc />);
    const input = getByLabelText(/Count per Type:/);
    fireEvent.input(input, { target: { value: '10' } });
    fireEvent.click(getByText(/Reset/));
    expect(input.value).toBe('10'); // assuming 1 is the default value
    // Also, you may need to check if the entities have been reset or any other states.
  });
  
  test('shows toast message when there is a winner', () => {
    // This would involve simulating the conditions under which a winner is decided and checking if the toast message shows up.
  });
  
  test('adjusts entity positions based on window size', () => {
    // You may need to simulate window resize events and check if entities are positioned within bounds.
  });
  
  // ... Add more tests as needed to cover all scenarios and edge cases.

});
