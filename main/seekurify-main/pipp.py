import torch
import torch.nn as nn
import torch.optim as optim
torch.manual_seed(42)

# Training data (y = 2x - 1)
X = torch.tensor([[1.0], [2.0], [3.0], [4.0]])
y = torch.tensor([[1.0], [3.0], [5.0], [7.0]])

# Step 1: Build the neural network
class SimpleNN(nn.Module):
    def __init__(self):
        super(SimpleNN, self).__init__()
        self.layer = nn.Linear(1, 1)

    def forward(self, x):
        return self.layer(x)

model = SimpleNN()
criterion = nn.MSELoss()
optimizer = optim.SGD(model.parameters(), lr=0.01)

# Step 2: Train
epochs = 500

for epoch in range(epochs):
    predictions = model(X)
    loss = criterion(predictions, y)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    if (epoch+1) % 50 == 0:
        print(f"Epoch {epoch+1}, Loss: {loss.item():.4f}")

# Step 3: Test

test_value = torch.tensor([[10.0]])
print("Prediction for x=10:", model(test_value).item())
