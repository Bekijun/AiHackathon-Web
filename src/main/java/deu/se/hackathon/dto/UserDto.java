package deu.se.hackathon.dto;

import lombok.Data;

@Data
public class UserDto {
    private String username;
    private String password;
    private String role;
    private Long hospitalId; // 병원 계정일 경우만 사용
}
