package deu.se.hackathon.repository;

import deu.se.hackathon.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}
