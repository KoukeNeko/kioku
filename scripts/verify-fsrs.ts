import { fsrs, createEmptyCard, Rating, State } from 'ts-fsrs';

function verifyFSRS() {
    console.log("Starting FSRS Harness...");
    
    const f = fsrs();
    
    // Create an empty card
    const card = createEmptyCard();
    console.log("Initial Card State:", card.state === State.New ? "New" : "Other");

    // Simulate scheduling a newly learned card (Rating: Good)
    const now = new Date();
    const schedulingCards = f.repeat(card, now);
    const goodCard = schedulingCards[Rating.Good].card;
    
    console.log("Card State after 'Good':", goodCard.state === State.Learning ? "Learning" : "Other");
    console.log("New Due Date:", goodCard.due.toISOString());

    // Verify it doesn't break and moves state forward
    if (goodCard.state !== State.Learning) {
        console.error("FAIL: FSRS did not transition state properly.");
        process.exit(1);
    }
    
    console.log("SUCCESS: FSRS scheduling works as expected.");
}

verifyFSRS();
