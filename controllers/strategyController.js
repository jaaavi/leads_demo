const {
  getStrategyById,
  getActiveStrategy,
  listStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  setActiveStrategy,
  setActiveStrategyForUser,
  getActiveStrategyForUser,
  getStrategyMessages,
  getStrategyMessage,
  createStrategyMessage,
  updateStrategyMessage,
  deleteStrategyMessage,
  deleteStrategyMessageByStrategyAndType
} = require('../models/strategyModel');

async function getStrategiesPage(req, res) {
  try {
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategies = await listStrategies(userId);
    const activeStrategy = await getActiveStrategyForUser(userId);

    res.render('admin/strategies', {
      session: req.session,
      strategies,
      activeStrategy: activeStrategy ? activeStrategy.id : null,
      userRole,
      userId
    });
  } catch (err) {
    console.error('Error loading strategies page:', err);
    res.status(500).render('admin/strategies', {
      session: req.session,
      strategies: [],
      error: 'Error cargando las estrategias'
    });
  }
}

async function listStrategiesJSON(req, res) {
  try {
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategies = await listStrategies(userId);
    const activeStrategy = await getActiveStrategyForUser(userId);

    const strategiesWithMessages = await Promise.all(
      strategies.map(async (strategy) => {
        const messages = await getStrategyMessages(strategy.id);
        return {
          ...strategy,
          messages,
          isActive: activeStrategy && activeStrategy.id === strategy.id
        };
      })
    );

    res.json({
      ok: true,
      data: strategiesWithMessages
    });
  } catch (err) {
    console.error('Error listing strategies:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function getStrategy(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategy = await getStrategyById(id);

    if (!strategy) {
      return res.status(404).json({ ok: false, error: 'Strategy not found' });
    }

    // For comercial_pro users, ensure they can only view their own strategies or global ones
    if (userRole === 'comercial_pro' && strategy.user_id !== userId && strategy.user_id !== null) {
      return res.status(403).json({ ok: false, error: 'Cannot view another user\'s strategy' });
    }

    const messages = await getStrategyMessages(id);
    const activeStrategy = await getActiveStrategyForUser(userId);

    res.json({
      ok: true,
      data: {
        ...strategy,
        messages,
        isActive: activeStrategy && activeStrategy.id === strategy.id
      }
    });
  } catch (err) {
    console.error('Error getting strategy:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function createStrategyHandler(req, res) {
  try {
    const { name, description, messages = {} } = req.body;
    const userRole = req.session?.userRole || 'admin';
    const userId = userRole === 'comercial_pro' ? req.session?.userId : null;

    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, error: 'Strategy name is required' });
    }

    const strategy = await createStrategy({
      name: name.trim(),
      description: description || null,
      createdBy: req.session?.userId || null,
      userId: userId
    });

    for (const [messageType, messageData] of Object.entries(messages)) {
      if (messageData && messageData.content) {
        await createStrategyMessage({
          strategyId: strategy.id,
          messageType,
          content: messageData.content,
          phase: messageData.phase || 1
        });
      }
    }

    res.json({
      ok: true,
      message: 'Strategy created successfully',
      data: strategy
    });
  } catch (err) {
    console.error('Error creating strategy:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, error: 'Strategy name already exists' });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function updateStrategyHandler(req, res) {
  try {
    const { id } = req.params;
    const { name, description, isActive, messages = {} } = req.body;
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategy = await getStrategyById(id);
    if (!strategy) {
      return res.status(404).json({ ok: false, error: 'Strategy not found' });
    }

    // For comercial_pro users, ensure they can only update their own strategies
    if (userRole === 'comercial_pro' && strategy.user_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Cannot update another user\'s strategy' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (Object.keys(updateData).length > 0) {
      await updateStrategy(id, updateData);
    }

    for (const [messageType, messageData] of Object.entries(messages)) {
      if (messageData && messageData.content) {
        const existing = await getStrategyMessage(id, messageType);
        if (existing) {
          await updateStrategyMessage(existing.id, {
            content: messageData.content,
            phase: messageData.phase || existing.phase
          });
        } else {
          await createStrategyMessage({
            strategyId: id,
            messageType,
            content: messageData.content,
            phase: messageData.phase || 1
          });
        }
      }
    }

    res.json({
      ok: true,
      message: 'Strategy updated successfully'
    });
  } catch (err) {
    console.error('Error updating strategy:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function deleteStrategyHandler(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategy = await getStrategyById(id);
    if (!strategy) {
      return res.status(404).json({ ok: false, error: 'Strategy not found' });
    }

    // For comercial_pro users, ensure they can only delete their own strategies
    if (userRole === 'comercial_pro' && strategy.user_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Cannot delete another user\'s strategy' });
    }

    const deleted = await deleteStrategy(id);

    if (deleted) {
      res.json({ ok: true, message: 'Strategy deleted successfully' });
    } else {
      res.status(400).json({ ok: false, error: 'Could not delete strategy' });
    }
  } catch (err) {
    console.error('Error deleting strategy:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function setActiveStrategyHandler(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategy = await getStrategyById(id);
    if (!strategy) {
      return res.status(404).json({ ok: false, error: 'Strategy not found' });
    }

    // For comercial_pro users, ensure they can only activate their own strategies
    if (userRole === 'comercial_pro' && strategy.user_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Cannot activate another user\'s strategy' });
    }

    await setActiveStrategyForUser(id, userId);

    res.json({
      ok: true,
      message: 'Strategy activated successfully'
    });
  } catch (err) {
    console.error('Error activating strategy:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function addStrategyMessage(req, res) {
  try {
    const { strategyId } = req.params;
    const { messageType, content, phase = 1 } = req.body;
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return res.status(404).json({ ok: false, error: 'Strategy not found' });
    }

    // For comercial_pro users, ensure they can only modify their own strategies
    if (userRole === 'comercial_pro' && strategy.user_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Cannot modify another user\'s strategy' });
    }

    if (!messageType || !content) {
      return res.status(400).json({ ok: false, error: 'Message type and content are required' });
    }

    const message = await createStrategyMessage({
      strategyId,
      messageType,
      content,
      phase
    });

    res.json({
      ok: true,
      message: 'Message added to strategy',
      data: message
    });
  } catch (err) {
    console.error('Error adding strategy message:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, error: 'Message type already exists for this strategy' });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function updateStrategyMessageHandler(req, res) {
  try {
    const { strategyId, messageId } = req.params;
    const { content, phase } = req.body;
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return res.status(404).json({ ok: false, error: 'Strategy not found' });
    }

    // For comercial_pro users, ensure they can only modify their own strategies
    if (userRole === 'comercial_pro' && strategy.user_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Cannot modify another user\'s strategy' });
    }

    const updated = await updateStrategyMessage(messageId, { content, phase });

    if (updated) {
      res.json({ ok: true, message: 'Message updated successfully' });
    } else {
      res.status(400).json({ ok: false, error: 'Could not update message' });
    }
  } catch (err) {
    console.error('Error updating strategy message:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function deleteStrategyMessageHandler(req, res) {
  try {
    const { strategyId, messageId } = req.params;
    const userRole = req.session?.userRole || 'admin';
    const userId = (userRole === 'comercial_pro' || userRole === 'admin') ? req.session?.userId : null;

    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return res.status(404).json({ ok: false, error: 'Strategy not found' });
    }

    // For comercial_pro users, ensure they can only modify their own strategies
    if (userRole === 'comercial_pro' && strategy.user_id !== userId) {
      return res.status(403).json({ ok: false, error: 'Cannot modify another user\'s strategy' });
    }

    const deleted = await deleteStrategyMessage(messageId);

    if (deleted) {
      res.json({ ok: true, message: 'Message deleted successfully' });
    } else {
      res.status(400).json({ ok: false, error: 'Could not delete message' });
    }
  } catch (err) {
    console.error('Error deleting strategy message:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getStrategiesPage,
  listStrategiesJSON,
  getStrategy,
  createStrategyHandler,
  updateStrategyHandler,
  deleteStrategyHandler,
  setActiveStrategyHandler,
  addStrategyMessage,
  updateStrategyMessageHandler,
  deleteStrategyMessageHandler
};
