import express from 'express';
import simulationService from '../services/simulation.service';
import personTrackingService from '../services/personTracking.service';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Start a new person simulation
 */
router.post('/start', async (req, res) => {
  try {
    const { name, age, description, photo_url } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const person_id = await simulationService.startPersonSimulation({
      name,
      age,
      description,
      photo_url,
    });

    res.json({
      success: true,
      person_id,
      message: `Simulation started for ${name}`,
    });
  } catch (error: any) {
    console.error('Start simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Start crowd simulation (multiple people)
 */
router.post('/crowd', async (req, res) => {
  try {
    const { count = 3 } = req.body;
    
    const personIds = await simulationService.simulateCrowd(count);

    res.json({
      success: true,
      person_ids: personIds,
      count: personIds.length,
      message: `Started simulation for ${personIds.length} people`,
    });
  } catch (error: any) {
    console.error('Crowd simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually move a person to a zone
 */
router.post('/move/:person_id', async (req, res) => {
  try {
    const { person_id } = req.params;
    const { to_zone, detection_method = 'manual' } = req.body;

    if (!to_zone) {
      return res.status(400).json({ error: 'to_zone is required' });
    }

    const result = await simulationService.manuallyMovePerson(
      person_id,
      to_zone,
      detection_method
    );

    res.json({
      success: true,
      person: result.person,
      movement: result.movement,
    });
  } catch (error: any) {
    console.error('Manual move error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Stop a simulation
 */
router.post('/stop/:person_id', async (req, res) => {
  try {
    const { person_id } = req.params;
    
    await simulationService.stopSimulation(person_id);

    res.json({
      success: true,
      message: `Simulation stopped for ${person_id}`,
    });
  } catch (error: any) {
    console.error('Stop simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all active simulations
 */
router.get('/active', (req, res) => {
  try {
    const activeSimulations = simulationService.getActiveSimulations();

    res.json({
      success: true,
      active_simulations: activeSimulations,
      count: activeSimulations.length,
    });
  } catch (error: any) {
    console.error('Get active simulations error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all tracked persons in a zone
 */
router.get('/zone/:zone_id/persons', async (req, res) => {
  try {
    const { zone_id } = req.params;
    const persons = await personTrackingService.getPersonsInZone(zone_id);

    res.json({
      success: true,
      zone_id,
      persons,
      count: persons.length,
    });
  } catch (error: any) {
    console.error('Get persons in zone error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get person details and movement history
 */
router.get('/person/:person_id', async (req, res) => {
  try {
    const { person_id } = req.params;
    
    const person = await personTrackingService.getPersonById(person_id);
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const movements = await personTrackingService.getPersonMovements(person_id);

    res.json({
      success: true,
      person,
      movements,
      movement_count: movements.length,
    });
  } catch (error: any) {
    console.error('Get person error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all active tracked persons
 */
router.get('/persons/all', async (req, res) => {
  try {
    const persons = await personTrackingService.getAllActivePersons();

    res.json({
      success: true,
      persons,
      count: persons.length,
    });
  } catch (error: any) {
    console.error('Get all persons error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
