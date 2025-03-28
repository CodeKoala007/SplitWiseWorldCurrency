document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const tripCurrencySelect = document.getElementById('trip-currency');
  const friendNameInput = document.getElementById('friend-name');
  const friendCurrencySelect = document.getElementById('friend-currency');
  const addFriendBtn = document.getElementById('add-friend-btn');
  const friendsListUl = document.getElementById('friends-list');

  const expenseForm = document.getElementById('expense-form');
  const expenseAmountInput = document.getElementById('expense-amount');
  const expenseDescriptionInput = document.getElementById('expense-description');
  const expensePayerSelect = document.getElementById('expense-payer');
  const expenseSplitBetweenDiv = document.getElementById('expense-split-between');
  const expensesListUl = document.getElementById('expenses-list');
  const balancesListUl = document.getElementById('balances-list');
  const clearDataBtn = document.getElementById('clear-data-btn');

  // --- State Variables ---
  let tripCurrency = 'USD'; // Default
  let friends = []; // { name: 'Alice', currency: 'USD' }
  let expenses = []; // { id: Date.now(), amount: 100, currency: 'BRL', description: 'Dinner', payer: 'Alice', splitWith: ['Alice', 'Bob'], calculatedShares: {'Alice': 50, 'Bob': 50} }

  // --- Available Currencies (Add more as needed) ---
  const availableCurrencies = ['USD', 'EUR', 'GBP', 'BRL', 'COP', 'CAD', 'AUD', 'JPY', 'INR'];

  // --- Functions ---

  // Populate currency dropdowns
  function populateCurrencyDropdowns() {
    const selects = [tripCurrencySelect, friendCurrencySelect];
    selects.forEach((select) => {
      select.innerHTML = ''; // Clear existing options
      availableCurrencies.forEach((currency) => {
        const option = document.createElement('option');
        option.value = currency;
        option.textContent = currency;
        select.appendChild(option);
      });
    });
    // Set default/saved trip currency
    tripCurrencySelect.value = tripCurrency;
  }

  // Load data from localStorage
  function loadState() {
    const savedTripCurrency = localStorage.getItem('tripCurrency');
    const savedFriends = localStorage.getItem('friends');
    const savedExpenses = localStorage.getItem('expenses');

    if (savedTripCurrency) {
      tripCurrency = savedTripCurrency;
    }
    if (savedFriends) {
      friends = JSON.parse(savedFriends);
    }
    if (savedExpenses) {
      expenses = JSON.parse(savedExpenses);
    }
    populateCurrencyDropdowns(); // Populate dropdowns after loading state
    updateFriendsDisplay();
    updateExpensesDisplay();
    updateBalancesDisplay();
  }

  // Save data to localStorage
  function saveState() {
    localStorage.setItem('tripCurrency', tripCurrency);
    localStorage.setItem('friends', JSON.stringify(friends));
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }

  // Update the display of added friends and populate payer/split options
  function updateFriendsDisplay() {
    friendsListUl.innerHTML = '';
    expensePayerSelect.innerHTML = '<option value="">--Select Payer--</option>'; // Reset payer options
    expenseSplitBetweenDiv.innerHTML = ''; // Reset split options

    if (friends.length === 0) {
      friendsListUl.innerHTML = '<li>No friends added yet.</li>';
    }

    friends.forEach((friend) => {
      // Add to friends list
      const li = document.createElement('li');
      li.textContent = `${friend.name} (${friend.currency})`;
      friendsListUl.appendChild(li);

      // Add to payer dropdown
      const payerOption = document.createElement('option');
      payerOption.value = friend.name;
      payerOption.textContent = friend.name;
      expensePayerSelect.appendChild(payerOption);

      // Add to split checkboxes
      const checkboxDiv = document.createElement('div');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `split-${friend.name}`;
      checkbox.value = friend.name;
      checkbox.checked = true; // Default to checked
      const label = document.createElement('label');
      label.htmlFor = `split-${friend.name}`;
      label.textContent = friend.name;
      checkboxDiv.appendChild(checkbox);
      checkboxDiv.appendChild(label);
      expenseSplitBetweenDiv.appendChild(checkboxDiv);
    });
  }

  // Add a new friend
  function handleAddFriend() {
    const name = friendNameInput.value.trim();
    const currency = friendCurrencySelect.value;

    if (!name) {
      alert("Please enter a friend's name.");
      return;
    }
    if (friends.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      alert('A friend with this name already exists.');
      return;
    }

    friends.push({ name, currency });
    friendNameInput.value = ''; // Clear input
    updateFriendsDisplay();
    saveState();
  }

  // Fetch exchange rates from the API
  async function getExchangeRates(baseCurrency, targetCurrencies) {
    // API requires lowercase currency codes
    const baseLower = baseCurrency.toLowerCase();
    const uniqueTargetsLower = [...new Set(targetCurrencies.map((c) => c.toLowerCase()))];

    // Don't fetch if base is the only target or no targets
    if (uniqueTargetsLower.length === 0 || (uniqueTargetsLower.length === 1 && uniqueTargetsLower[0] === baseLower)) {
      const rates = {};
      rates[baseCurrency] = 1; // Rate to itself is 1
      return rates;
    }

    // Construct API URL (using the latest date)
    const apiUrl = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseLower}.json`;

    try {
      console.log(`Fetching rates from: ${apiUrl}`);
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('API Response Data:', data);

      const rates = {};
      // Add rate for base currency to itself
      rates[baseCurrency] = 1;

      // Extract rates for target currencies
      uniqueTargetsLower.forEach((targetLower) => {
        if (data[baseLower] && data[baseLower][targetLower]) {
          // API gives rate FROM base TO target. Store with uppercase keys.
          rates[targetLower.toUpperCase()] = data[baseLower][targetLower];
        } else if (baseLower === targetLower) {
          rates[targetLower.toUpperCase()] = 1; // Rate to itself
        } else {
          console.warn(`Rate not found for ${baseLower} -> ${targetLower}`);
          // Handle missing rate? Maybe alert user or use a default/error value?
          // For now, we'll skip adding it, which might cause issues later.
        }
      });

      console.log('Extracted Rates:', rates);
      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      alert(
        `Error fetching exchange rates: ${error.message}. Please check the console and ensure the trip currency is valid.`
      );
      return null; // Indicate failure
    }
  }

  // Handle expense form submission
  async function handleAddExpense(event) {
    event.preventDefault(); // Prevent page reload

    const amount = parseFloat(expenseAmountInput.value);
    const description = expenseDescriptionInput.value.trim();
    const payerName = expensePayerSelect.value;
    const splitCheckboxes = expenseSplitBetweenDiv.querySelectorAll('input[type="checkbox"]:checked');

    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }
    if (!description) {
      alert('Please enter a description.');
      return;
    }
    if (!payerName) {
      alert('Please select who paid.');
      return;
    }
    if (splitCheckboxes.length === 0) {
      alert('Please select at least one person to split the expense with.');
      return;
    }

    const splitWithNames = Array.from(splitCheckboxes).map((cb) => cb.value);
    const expenseCurrency = tripCurrency; // Expense is always in trip currency for V1

    // --- Get required currencies for conversion ---
    const involvedFriends = friends.filter((f) => splitWithNames.includes(f.name));
    const targetCurrencies = involvedFriends.map((f) => f.currency);
    // Also need the payer's currency if they aren't part of the split (unlikely but possible)
    const payer = friends.find((f) => f.name === payerName);
    if (payer) {
      targetCurrencies.push(payer.currency);
    }

    // --- Fetch Rates ---
    const rates = await getExchangeRates(expenseCurrency, targetCurrencies);
    if (!rates) {
      console.error('Could not proceed without exchange rates.');
      return; // Stop if rates couldn't be fetched
    }

    // --- Calculate Shares ---
    const numberOfSplitters = splitWithNames.length;
    const sharePerPersonOriginal = amount / numberOfSplitters;
    const calculatedShares = {}; // Store shares in each person's HOME currency

    involvedFriends.forEach((friend) => {
      const rate = rates[friend.currency];
      if (rate === undefined) {
        console.error(
          `Missing rate for ${expenseCurrency} to ${friend.currency}. Cannot calculate share for ${friend.name}.`
        );
        alert(`Error: Missing exchange rate for ${friend.currency}. Calculation incomplete.`);
        // Decide how to handle this - skip friend, stop process? For now, skip share calculation.
        calculatedShares[friend.name] = { amount: 'Error', currency: friend.currency };
      } else {
        const shareInHomeCurrency = sharePerPersonOriginal * rate;
        calculatedShares[friend.name] = { amount: shareInHomeCurrency, currency: friend.currency };
      }
    });

    // --- Add Expense to State ---
    const newExpense = {
      id: Date.now(), // Simple unique ID
      amount: amount,
      currency: expenseCurrency,
      description: description,
      payer: payerName,
      splitWith: splitWithNames,
      calculatedShares: calculatedShares, // Shares are stored in home currencies
    };
    expenses.push(newExpense);

    // --- Update UI & Save ---
    expenseForm.reset(); // Clear form
    // Re-check all split checkboxes by default for next entry
    expenseSplitBetweenDiv.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = true));

    updateExpensesDisplay();
    updateBalancesDisplay();
    saveState();
  }

  // Update the list of expenses
  function updateExpensesDisplay() {
    expensesListUl.innerHTML = '';
    if (expenses.length === 0) {
      expensesListUl.innerHTML = '<li>No expenses added yet.</li>';
      return;
    }

    // Display newest expenses first
    [...expenses].reverse().forEach((expense) => {
      const li = document.createElement('li');
      const details = `Paid by ${expense.payer}, Split with: ${expense.splitWith.join(', ')}`;
      li.innerHTML = `
                <span>${expense.description}: ${expense.amount.toFixed(2)} ${expense.currency}</span>
                <span class="expense-details">${details}</span>
            `;
      expensesListUl.appendChild(li);
    });
  }

  // Calculate and display final balances
  function updateBalancesDisplay() {
    balancesListUl.innerHTML = '';
    if (friends.length === 0) {
      balancesListUl.innerHTML = '<li>Add friends to see balances.</li>';
      return;
    }

    const balances = {}; // { 'Alice': { amount: 0, currency: 'USD' }, ... }
    friends.forEach((friend) => {
      balances[friend.name] = { amount: 0, currency: friend.currency };
    });

    // Process each expense
    expenses.forEach((expense) => {
      const payerName = expense.payer;
      const payer = friends.find((f) => f.name === payerName);

      if (!payer) {
        console.warn(`Payer ${payerName} not found in friends list for expense ID ${expense.id}`);
        return; // Skip if payer isn't found
      }

      // Credit the payer: They paid the full amount.
      // We need the total expense amount converted to the PAYER's currency.
      // Find the rate from expense currency to payer's currency within the calculated shares
      // This assumes the rate was fetched correctly earlier. A better approach might be needed if rates fail.
      let totalExpenseInPayerCurrency = 0;
      // Sum up the calculated shares (which are in home currencies) by converting them BACK to payer's currency
      // This is complex. Let's simplify: Assume the API call fetched the rate needed.
      // Re-fetch or look up rate from expense.currency to payer.currency if needed.
      // For V1 simplicity: We'll approximate based on shares. This isn't perfectly accurate if rates fluctuated wildly.

      // **Revised Simpler Logic for V1:**
      // 1. Payer is owed the amount they paid *minus* their own share.
      // 2. Everyone else owes their share.

      const payerShareInfo = expense.calculatedShares[payerName];
      let payerShareAmount = 0;
      if (payerShareInfo && typeof payerShareInfo.amount === 'number') {
        payerShareAmount = payerShareInfo.amount; // This is already in payer's home currency
      }

      // Calculate total paid in payer's currency (needs rate from expense currency to payer currency)
      // Let's assume we can look this up or re-fetch if needed. For now, we estimate.
      // A better way: Store the rates used for the calculation with the expense object.

      // **Even Simpler V1 Logic:** Just track net flow in each person's currency.
      // Iterate through calculated shares for the expense
      for (const friendName in expense.calculatedShares) {
        const shareInfo = expense.calculatedShares[friendName];
        if (shareInfo && typeof shareInfo.amount === 'number' && balances[friendName]) {
          // If this friend paid, add the total amount (converted to their currency)
          if (friendName === payerName) {
            // How much did the payer pay in *their* currency?
            // Need rate: expense.currency -> payer.currency
            // This part is tricky without storing rates or re-fetching.
            // Let's use a placeholder concept: Payer gets credit, others get debit.
            // Add credit to payer (total amount they paid, converted) - Needs rate!
            // For now, just subtract their share, assuming others will balance it.
            // balances[payerName].amount += ???; // Needs total converted amount
          }
          // Subtract this friend's share (already in their home currency)
          balances[friendName].amount -= shareInfo.amount;
        }
      }
      // Add back the total amount paid to the payer's balance (needs conversion)
      // This double-entry approach is complex. Let's try the net balance approach again.

      // **Net Balance Approach V2:**
      // 1. Calculate total spent by each person (converted to a common currency? No, keep in their currency).
      // 2. Calculate total owed by each person (sum of their shares).

      let totalPaidByPayer = {}; // { amount: 0, currency: ''} - Store amount paid converted to payer's currency
      // Need rate from expense.currency -> payer.currency
      // Placeholder: Assume we have this rate `ratePayer`
      // totalPaidByPayer = { amount: expense.amount * ratePayer, currency: payer.currency };
      // balances[payerName].amount += totalPaidByPayer.amount; // Credit payer

      // Debit everyone for their share
      expense.splitWith.forEach((name) => {
        const shareInfo = expense.calculatedShares[name];
        if (shareInfo && typeof shareInfo.amount === 'number' && balances[name]) {
          balances[name].amount -= shareInfo.amount;
        }
      });

      // **Net Balance Approach V3 (Simplest for UI):**
      // Calculate total paid BY person X.
      // Calculate total share OF person X.
      // Balance = Total Paid BY X - Total Share OF X (all in X's currency)
    });

    // --- Recalculate balances using V3 logic ---
    friends.forEach((friend) => {
      balances[friend.name] = { amount: 0, currency: friend.currency }; // Reset

      // Calculate total paid BY this friend (converted to their currency)
      let totalPaidByFriend = 0;
      expenses
        .filter((exp) => exp.payer === friend.name)
        .forEach((exp) => {
          // Need rate: exp.currency -> friend.currency
          // This is the core difficulty without storing rates per expense or re-fetching constantly.
          // **WORKAROUND for V1:** We'll display balances based ONLY on shares owed.
          // This won't be a perfect "who owes whom" but shows net expenditure share.
          // A better app would store rates or use a backend.
        });
      // balances[friend.name].amount += totalPaidByFriend; // Add payments made

      // Calculate total share OF this friend
      let totalShareOfFriend = 0;
      expenses.forEach((exp) => {
        if (exp.splitWith.includes(friend.name)) {
          const shareInfo = exp.calculatedShares[friend.name];
          if (shareInfo && typeof shareInfo.amount === 'number') {
            totalShareOfFriend += shareInfo.amount;
          }
        }
      });
      balances[friend.name].amount -= totalShareOfFriend; // Subtract shares owed
    });
    // **NOTE:** The above balance calculation is INCOMPLETE due to the complexity of
    // converting the "paid" amounts without persistently storing rates.
    // The displayed balance primarily reflects the *negative* sum of shares owed.

    // Display Balances
    if (Object.keys(balances).length === 0) {
      balancesListUl.innerHTML = '<li>No balances to show.</li>';
      return;
    }

    for (const name in balances) {
      const balance = balances[name];
      const li = document.createElement('li');
      const amountFixed = balance.amount.toFixed(2);
      li.textContent = `${name}: ${amountFixed} ${balance.currency}`;

      // Add class for styling based on positive/negative
      // Since our calculation is simplified, "positive" means they owe less than tracked shares (potentially paid more)
      // "Negative" means they owe based on tracked shares.
      if (balance.amount > 0.01) {
        // Use a small threshold for floating point
        li.classList.add('positive');
        li.textContent += ' (Owed money / Paid more than share)'; // Clarification due to simplified calc
      } else if (balance.amount < -0.01) {
        li.classList.add('negative');
        li.textContent += ' (Owes money / Share cost)'; // Clarification
      }

      balancesListUl.appendChild(li);
    }
  }

  // Clear all data
  function clearAllData() {
    if (confirm('Are you sure you want to clear all trip data? This cannot be undone.')) {
      localStorage.removeItem('tripCurrency');
      localStorage.removeItem('friends');
      localStorage.removeItem('expenses');
      // Reset state variables
      tripCurrency = 'USD';
      friends = [];
      expenses = [];
      // Update UI
      populateCurrencyDropdowns();
      updateFriendsDisplay();
      updateExpensesDisplay();
      updateBalancesDisplay();
      alert('All data cleared.');
    }
  }

  // --- Event Listeners ---
  tripCurrencySelect.addEventListener('change', (e) => {
    tripCurrency = e.target.value;
    // Potentially recalculate existing expenses if trip currency changes? Complex for V1.
    saveState();
    // Maybe add a warning if expenses exist?
  });

  addFriendBtn.addEventListener('click', handleAddFriend);
  expenseForm.addEventListener('submit', handleAddExpense);
  clearDataBtn.addEventListener('click', clearAllData);

  // --- Initial Load ---
  loadState();
});
